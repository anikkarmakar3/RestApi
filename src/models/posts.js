const express = require("express")
const mongoose = require("mongoose")
// const Scehema = mongoose.Schema

const postSchema = new mongoose.Schema({
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
},
{
    timestamps:Date.now
})

const Post = new mongoose.model('Post', postSchema);

module.exports = Post;