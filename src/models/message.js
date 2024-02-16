const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  });

  
const Message = new mongoose.model('Message', messageSchema);
module.exports = Message;