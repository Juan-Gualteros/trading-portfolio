const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const TradingAccount = require('../models/TradingAccount'); // Importar para crear la cuenta por defecto

let transporter;
async function initTransporter() {
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      let testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
          user: testAccount.user, 
          pass: testAccount.pass, 
        },
      });
      console.log("Nodemailer: Usando Ethereal Email para pruebas locales.");
    }
  } catch (err) {
    console.error("Error inicializando nodemailer:", err);
  }
}
initTransporter();

const register = async (req, res) => {
  try {
    const { username, password, email, first_name, last_name } = req.body;
    
    // Check if user exists by username or email
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso' });
    }
    
    if (email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verification_token = crypto.randomBytes(32).toString('hex');

    // Create user (Auto-verificado por ahora)
    const newUser = await User.create({
      username,
      password: hashedPassword,
      email,
      first_name,
      last_name,
      verification_token: null,
      is_verified: true
    });

    // Create default trading account for the user
    await TradingAccount.create({
      userId: newUser.id,
      name: 'Cuenta Principal',
      market_type: 'General',
      balance: 10000
    });

    res.status(201).json({ message: 'Usuario registrado exitosamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Check if verified (Desactivado temporalmente, siempre es true)
    if (user.is_verified === false) {
      // Ignoramos esta validación ya que el correo no se enviará
      // return res.status(403).json({ message: 'Por favor verifica tu correo electrónico antes de iniciar sesión.' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    // Create JWT
    const payload = {
      id: user.id,
      username: user.username
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1d' });

    res.json({ token, user: { id: user.id, username: user.username, first_name: user.first_name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ where: { verification_token: token } });
    
    if (!user) {
      return res.status(400).json({ message: 'Token de verificación inválido o expirado' });
    }
    
    user.is_verified = true;
    user.verification_token = null; // Clear token after verification
    await user.save();
    
    res.json({ message: 'Correo verificado exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'verification_token'] }
    });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: 'El correo electrónico ya está en uso' });
      }
    }

    user.first_name = first_name || user.first_name;
    user.last_name = last_name || user.last_name;
    user.email = email || user.email;

    await user.save();
    res.json({ message: 'Perfil actualizado exitosamente', user: { first_name: user.first_name, last_name: user.last_name, email: user.email } });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  getProfile,
  updateProfile,
  changePassword
};
