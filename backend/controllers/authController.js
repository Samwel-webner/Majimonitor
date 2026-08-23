const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const { sendPasswordResetEmail } = require('../services/emailService');

async function register(req, res) {
    try {
        const { name, email, password, role, gender } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'name, email, and password are required' });
        }

        const existing = await userModel.findUserByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const user = await userModel.createUser({ name, email, password_hash, role, gender });

        return res.status(201).json(user);
    } catch (err) {
        console.error('Error registering user:', err);
        return res.status(500).json({ error: 'Failed to register user' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'email and password are required' });
        }

        const user = await userModel.findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
        );

        return res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, gender: user.gender }
        });
    } catch (err) {
        console.error('Error logging in:', err);
        return res.status(500).json({ error: 'Failed to log in' });
    }
}

async function listUsers(req, res) {
    try {
        const users = await userModel.getAllUsers();
        return res.json(users);
    } catch (err) {
        console.error('Error listing users:', err);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
}

async function deleteUser(req, res) {
    try {
        const { id } = req.params;

        if (Number(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const result = await userModel.deleteUser(id);
        return res.json(result);
    } catch (err) {
        console.error('Error deleting user:', err);
        return res.status(500).json({ error: 'Failed to delete user' });
    }
}

async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'email is required' });
        }

        const user = await userModel.findUserByEmail(email);

        // Always respond the same way, whether or not the email exists -
        // this stops someone from using this endpoint to discover which
        // emails have accounts.
        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

            await userModel.setResetToken(email, token, expires);
            sendPasswordResetEmail({ toEmail: user.email, name: user.name, token });
        }

        return res.json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (err) {
        console.error('Error in forgotPassword:', err);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}

async function resetPassword(req, res) {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'token and password are required' });
        }

        const user = await userModel.findUserByResetToken(token);
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset link' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        await userModel.updatePasswordAndClearToken(user.id, password_hash);

        return res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error in resetPassword:', err);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
}

async function changePassword(req, res) {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'currentPassword and newPassword are required' });
        }

        const user = await userModel.findUserByIdWithPassword(req.user.id);
        const matches = await bcrypt.compare(currentPassword, user.password_hash);
        if (!matches) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const password_hash = await bcrypt.hash(newPassword, 10);
        await userModel.updatePasswordAndClearToken(user.id, password_hash);

        return res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Error changing password:', err);
        return res.status(500).json({ error: 'Failed to change password' });
    }
}

module.exports = { register, login, listUsers, deleteUser, forgotPassword, resetPassword, changePassword };