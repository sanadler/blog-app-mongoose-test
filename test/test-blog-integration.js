'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the expect syntax available throughout
// this module
const expect = chai.expect;

const {Post} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

// used to put randomish documents in db
// so we have data to work with and assert about.
// we use the Faker library to automatically
// generate placeholder values for author, title, content
// and then we insert that data into mongo
function seedPostData() {
  console.info('seeding post data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generatePostData());
  }
  // this will return a promise
  return Post.insertMany(seedData);
}

// used to generate data to put in db
function generateTitle() {
  const titles = [
    'post1', 'post2', 'post3', 'post4', 'post5'];
  return titles[Math.floor(Math.random() * titles.length)];
}

function generatePostData() {
  return {
    title: generateTitle(),
    author: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    },
    content: faker.lorem.text(),
    created: faker.date.past()
  };
}

// this function deletes the entire database.
// we'll call it in an `afterEach` block below
// to ensure data from one test does not stick
// around for next one
function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

describe('Blog Post API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedPostData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });


  describe('GET endpoint', function() {

    it('should return all existing posts', function() {

      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          res = _res;
          expect(res).to.have.status(200);
          expect(res.body.posts).to.have.lengthOf.at.least(1);
          return Post.count();
        })
        .then(function(count) {
          expect(res.body.posts).to.have.lengthOf(count);
        });
    });


    it('should return posts with right fields', function() {

      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          expect(res).to.have.status(200);
          expect(res).to.be.json;
          expect(res.body.posts).to.be.a('array');
          expect(res.body.posts).to.have.lengthOf.at.least(1);

          res.body.posts.forEach(function(post) {
            expect(post).to.be.a('object');
            expect(post).to.include.keys(
              'id', 'title', 'author', 'content', 'created');
          });
          resPost = res.body.posts[0];
          console.log(resPost);
          return Post.findById(resPost.id);
        })
        .then(function(post) {

          expect(resPost.id).to.equal(post.id);
          expect(resPost.title).to.equal(post.title);
          expect(resPost.author).to.equal(post.authorString);
          expect(resPost.content).to.equal(post.content);
      //    expect(resPost.created).to.equal(post.created);
        });
    });
  });

  describe('POST endpoint', function() {

    it('should add a new post', function() {

      const newPost = generatePostData();

      return chai.request(app)
        .post('/posts')
        .send(newPost)
        .then(function(res) {
          expect(res).to.have.status(201);
          expect(res).to.be.json;
          expect(res.body).to.be.a('object');
          expect(res.body).to.include.keys(
            'id', 'title', 'author', 'content');
          expect(res.body.title).to.equal(newPost.title);
          // cause Mongo should have created id on insertion
          expect(res.body.id).to.not.be.null;
          expect(res.body.author).to.equal(newPost.author.firstName + ' ' + newPost.author.lastName);
          expect(res.body.content).to.equal(newPost.content);

          return Post.findById(res.body.id);
        })
        .then(function(post) {
            expect(post.title).to.equal(newPost.title);
            expect(post.authorString).to.equal(newPost.author.firstName + ' ' + newPost.author.lastName);
            expect(post.content).to.equal(newPost.content);
           // expect(post.created).to.equal(newPost.created);
        });
    });
  });

  describe('PUT endpoint', function() {

    it('should update fields you send over', function() {
      const updateData = {
        title: 'fofofofofofofof',
        content: 'this is content'
      };

      return Post
        .findOne()
        .then(function(post) {
          updateData.id = post.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updateData);
        })
        .then(function(res) {
          expect(res).to.have.status(204);

          return Post.findById(updateData.id);
        })
        .then(function(post) {
          expect(post.title).to.equal(updateData.title);
          expect(post.content).to.equal(updateData.content);
        });
    });
  });

  describe('DELETE endpoint', function() {

    it('delete a post by id', function() {

      let post;

      return Post
        .findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          expect(res).to.have.status(204);
          return Post.findById(post.id);
        })
        .then(function(_post) {
          expect(_post).to.be.null;
        });
    });
  });
});
