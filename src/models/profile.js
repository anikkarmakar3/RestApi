const express = require("express")
const mongoose = require("mongoose")
const Schema = mongoose.Schema

const profile = new mongoose.Schema({
    phonenumber:{
        type:Number,
    },
    profilename:{
        type:String,
    },
    profilephoto:{
        type:Number,
    },
    profileemail:{
        type:String,
    },
    userid:{
        type:String,
    },
    posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }], // Reference to posts
    connections: [{ type: Schema.Types.ObjectId, ref: 'Profile' }], // Reference to other users
    requestedConnections: [{ type: Schema.Types.ObjectId, ref: 'Profile' }] // Reference to users who requested connection
})

const Profile = new mongoose.model('Profile', profile);

module.exports = Profile;