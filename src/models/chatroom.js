// Chat Room Schema
const mongoose = require('mongoose');


const chatRoomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }],
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  });

const Chatroom = new mongoose.model('Chatroom', chatRoomSchema);
module.exports = Chatroom;

