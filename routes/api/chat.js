const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const Chat = require('../../models/Chat');
const User = require('../../models/User');

//get all chats
router.get('/', auth, async (req, res) => {
  try {
    Chat.find({ users: { $elemMatch: { $eq: req.user.id } } })
      .populate('users', '-password')
      .populate('groupAdmin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 })
      .then(async (results) => {
        results = await User.populate(results, {
          path: 'latestMessage.sender',
          select: 'name pic email'
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400).json({ error: 'server error' });
    console.log(error);
  }
});

//create private chat
router.post(
  '/createPersonalChat',
  check('userId', 'userId is required').notEmpty(),
  auth,
  async (req, res) => {
    const { userId } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });  
    }
    if (!userId) {
      console.log('UserId param not sent with request');
      return res.sendStatus(400);
    }

    var isChat = await Chat.find({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user.id } } },
        { users: { $elemMatch: { $eq: userId } } }
      ]
    })
      .populate('users', '-password')
      .populate('latestMessage');

    isChat = await User.populate(isChat, {
      path: 'latestMessage.sender',
      select: 'name avatar email'
    });

    if (isChat.length > 0) {
      res.send(isChat[0]);
    } else {
      var chatData = {
        chatName: 'sender',
        isGroupChat: false,
        users: [req.user.id, userId]
      };

      try {
        const createdChat = await Chat.create(chatData);
        const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
          'users',
          '-password'
        );
        res.status(200).json(FullChat);
      } catch (error) {
        console.log(error.message);
        res.status(500).json({ error: error.message });
      }
    }
  }
);

//create group chat
router.post(
  '/createGroupChat',
  auth,
  check('name', 'name is required').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.body.users || !req.body.name) {
      return res.status(400).send({ message: 'Please Fill all the feilds' });
    }

    var users = JSON.parse(req.body.users);
    // console.log(users)
    if (users.length < 2) {
      return res
        .status(400)
        .send('More than 2 users are required to form a group chat');
    }

    users.push(req.user.id);

    try {
      const groupChat = new Chat({
        chatName: req.body.name,
        users: users,
        isGroupChat: true,
        groupAdmin: req.user.id
      });
      await groupChat.save();
      const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
        .populate('users', '-password')
        .populate('groupAdmin', '-password');
      res.status(200).json(fullGroupChat);
    } catch (error) {
      console.log(error.message);
      res.status(500).json({ error: error.message });
    }
  }
);

//rename group chat
router.put(
  '/renameGroup',
  check('chatId', 'chatId is required').notEmpty(),
  check('chatName', 'chatName is required').notEmpty(),
  auth,
  async (req, res) => {
    const { chatId, chatName } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const updatedChat = await Chat.findByIdAndUpdate(
        chatId,
        {
          chatName: chatName
        },
        {
          new: true
        }
      )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

      if (!updatedChat) {
        res.status(404).json({ error: 'Chat Not Found' });
      } else {
        res.json(updatedChat);
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'server error' });
    }
  }
);

//add group participant
router.put(
  '/addGroupParticipant',
  check('chatId', 'chatId is required').notEmpty(),
  check('userId', 'userId is required').notEmpty(),
  auth,
  async (req, res) => {
    const { chatId, userId } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // check if the requester is admin

    try {
      const added = await Chat.findByIdAndUpdate(
        chatId,
        {
          $push: { users: userId }
        },
        {
          new: true
        }
      )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

      if (!added) {
        res.status(404).json({ error: 'Chat Not Found' });
      } else {
        res.json(added);
      }
    } catch (err) {
      console.log(err);
      res.status(500).json({ error: 'server error' });
    }
  }
);

//remove group paricipant
router.put(
  '/removeGroupParticipant',
  check('chatId', 'chatId is required').notEmpty(),
  check('userId', 'userId is required').notEmpty(),
  auth,
  async (req, res) => {
    const { chatId, userId } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // TO DO - check if the requester is admin
    try {
      const removed = await Chat.findByIdAndUpdate(
        chatId,
        {
          $pull: { users: userId }
        },
        {
          new: true
        }
      )
        .populate('users', '-password')
        .populate('groupAdmin', '-password');

      if (!removed) {
        res.status(404).json({ error: 'Chat Not Found' });
      } else {
        res.json(removed);
      }
    } catch (err) {
      res.send(500).json({ error: 'server error' });
      console.log(err.message);
    }
  }
);

module.exports = router;
