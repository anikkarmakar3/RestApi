const express = require("express")
const mongoose = require("mongoose")
const Schema = mongoose.Schema

const profile = new mongoose.Schema({
    phonenumber:{
        type:Number,
        require:true,
        unique:true
    },
    profilename:{
        type:String,
    },
    profilephoto:[{ type: Schema.Types.ObjectId, ref: 'ProfilePhoto' }],
    profileemail:{
        type:String,
    },
    userid:{
        type:String,
    },
    is_online:{
        type:String,
        default:'0'
    },
    posts: [{ type: Schema.Types.ObjectId, ref: 'Post' }], // Reference to posts
    connections: [{ type: Schema.Types.ObjectId, ref: 'Profile' }], // Reference to other users
    requestedConnections: [{ type: Schema.Types.ObjectId, ref: 'Profile' }] // Reference to users who requested connection
},
{
    timestamps:Date.now
})

const Profile = new mongoose.model('Profile', profile);

module.exports = Profile;