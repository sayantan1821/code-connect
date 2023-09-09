const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const Message = require('../../models/Message');
const Chat = require('../../models/Chat');
const User = require('../../models/User');
const auth = require('../../middleware/auth');

router.get('/:chatId', auth, async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name pic email')
      .populate('chat');
    res.json(messages);
  } catch (error) {
    res.status(400).json({error : "server error"});
    console.log(error.message);
  }
});

router.post('/', auth, async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log('Invalid data passed into request');
    return res.sendStatus(400);
  }

  var newMessage = {
    sender: req.user.id,
    content: content,
    chat: chatId
  };

  try {
    var message = await Message.create(newMessage);

    message = await message.populate('sender', 'name pic').execPopulate();
    message = await message.populate('chat').execPopulate();
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'name pic email'
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400).json({error : "server error"});
    console.log(error.message);
  }
});

module.exports = router;
