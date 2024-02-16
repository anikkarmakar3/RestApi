const mongoose = require("mongoose")
const photoSchema = new mongoose.Schema({
    title: String,
    imageUrl: String,
    profile: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' }
});
const Photo = mongoose.model('ProfilePhoto', photoSchema);
module.exports = Photo;