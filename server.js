// server.js
require('dotenv').config(); // Add this line at the top

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB connection - Use in-memory database for testing
const { MongoMemoryServer } = require('mongodb-memory-server');

async function connectToDatabase() {
    try {
        // Try to use Atlas connection first, fallback to memory server
        const MONGODB_URI = process.env.MONGODB_URI;
        
        if (MONGODB_URI && MONGODB_URI !== 'mongodb+srv://username:password@cluster.mongodb.net/amul_ecommerce') {
            try {
                await mongoose.connect(MONGODB_URI, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                });
                console.log('✅ Connected to MongoDB Atlas');
                return;
            } catch (atlasError) {
                console.log('❌ Atlas connection failed, using in-memory database...');
            }
        }
        
        // Fallback to in-memory database
        const mongod = await MongoMemoryServer.create();
        const uri = mongod.getUri();
        
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Connected to In-Memory MongoDB (for testing)');
        console.log('🔄 Your data will be temporary - set up MongoDB Atlas for production');
        
    } catch (err) {
        console.error('❌ Database connection error:', err);
        process.exit(1);
    }
}

// Initialize database connection
connectToDatabase();

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: String },
    available: { type: Boolean, default: true }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// JWT Secret - Updated to use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Debug function to check admin user
async function debugAdminUser() {
    try {
        console.log('=== CHECKING ADMIN USER ===');
        const adminUser = await User.findOne({ username: 'jitendra' });
        
        if (adminUser) {
            console.log('Admin user exists:');
            console.log('- ID:', adminUser._id);
            console.log('- Username:', adminUser.username);
            console.log('- Role:', adminUser.role);
            console.log('- Has password:', !!adminUser.password);
            console.log('- Password length:', adminUser.password ? adminUser.password.length : 0);
            console.log('- Created at:', adminUser.createdAt);
        } else {
            console.log('Admin user does NOT exist');
        }

        // Count total users
        const userCount = await User.countDocuments();
        console.log('Total users in database:', userCount);
        
    } catch (error) {
        console.error('Error checking admin user:', error);
    }
}

// Initialize default admin user - Updated with debug logging
async function initializeAdmin() {
    try {
        console.log('=== INITIALIZING ADMIN ===');
        const adminExists = await User.findOne({ role: 'admin' });
        
        if (!adminExists) {
            console.log('Creating new admin user...');
            const hashedPassword = await bcrypt.hash('Gunjan@@', 10);
            console.log('Password hashed successfully');
            
            const admin = new User({
                username: 'jitendra',
                password: hashedPassword,
                role: 'admin'
            });
            
            await admin.save();
            // console.log('✅ Default admin user created: username: jitendra, password: Gunjan@@');
        } else {
            console.log('✅ Admin user already exists');
        }
        
        // Run debug check
        await debugAdminUser();
        
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    }
}

// Routes

// Authentication Routes - Updated with debug logging
app.post('/api/auth/login', async (req, res) => {
    try {
        console.log('=== LOGIN ATTEMPT ===');
        console.log('Request body:', req.body);
        
        const { username, password } = req.body;

        if (!username || !password) {
            console.log('Missing username or password');
            return res.status(400).json({ message: 'Username and password are required' });
        }

        console.log('Looking for user with username:', username);
        const user = await User.findOne({ username });
        console.log('User found:', user ? 'YES' : 'NO');
        
        if (user) {
            console.log('User details:', {
                id: user._id,
                username: user.username,
                hasPassword: !!user.password,
                passwordLength: user.password ? user.password.length : 0
            });
        }

        if (!user) {
            console.log('User not found - returning invalid credentials');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('Comparing passwords...');
        console.log('Provided password:', password);
        console.log('Stored password hash (first 20 chars):', user.password.substring(0, 20) + '...');
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        console.log('Password comparison result:', isValidPassword);
        
        if (!isValidPassword) {
            console.log('Password invalid - returning invalid credentials');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        console.log('Login successful - generating token');
        const token = jwt.sign(
            { userId: user._id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Token generated successfully');
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        valid: true,
        user: {
            id: req.user.userId,
            username: req.user.username,
            role: req.user.role
        }
    });
});

// Product Routes

// Get all products (public)
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ message: 'Failed to fetch products' });
    }
});

// Get single product (public)
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ message: 'Failed to fetch product' });
    }
});

// Add new product (admin only)
app.post('/api/products', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name, price } = req.body;

        if (!name || !price) {
            return res.status(400).json({ message: 'Name and price are required' });
        }

        const productData = {
            name,
            price: parseFloat(price),
            available: true
        };

        if (req.file) {
            productData.image = `/uploads/${req.file.filename}`;
        }

        const product = new Product(productData);
        const savedProduct = await product.save();

        res.status(201).json({
            message: 'Product added successfully',
            product: savedProduct
        });
    } catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ message: 'Failed to add product' });
    }
});

// Update product (admin only)
app.put('/api/products/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name, price, available } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (price) updateData.price = parseFloat(price);
        if (available !== undefined) updateData.available = available === 'true';

        if (req.file) {
            updateData.image = `/uploads/${req.file.filename}`;
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.json({
            message: 'Product updated successfully',
            product
        });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ message: 'Failed to update product' });
    }
});

// Toggle product availability (admin only)
app.patch('/api/products/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.available = !product.available;
        const updatedProduct = await product.save();

        res.json({
            message: 'Product status updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Toggle product error:', error);
        res.status(500).json({ message: 'Failed to update product status' });
    }
});

// Delete product (admin only)
app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Delete associated image file if it exists
        if (product.image) {
            const imagePath = path.join(__dirname, product.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await Product.findByIdAndDelete(req.params.id);

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ message: 'Failed to delete product' });
    }
});

// Search products (public)
app.get('/api/products/search/:query', async (req, res) => {
    try {
        const query = req.params.query;
        const products = await Product.find({
            name: { $regex: query, $options: 'i' }
        }).sort({ createdAt: -1 });

        res.json(products);
    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({ message: 'Failed to search products' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
        }
    }
    
    if (error.message === 'Only image files are allowed!') {
        return res.status(400).json({ message: 'Only image files are allowed!' });
    }

    console.error('Unhandled error:', error);
    res.status(500).json({ message: 'Internal server error' });
});

const { exec } = require('child_process');

// Construct the path to your HTML file
const filePath = path.join(__dirname, 'index.html'); // Adjust if your HTML is in a sub-directory

// Function to open the HTML file in the default browser
// function openHtmlFile() {
//     const command = `start "" "${filePath}"`; // Command to open in Windows

//     exec(command, (err) => {
//         if (err) {
//             console.error(`Error opening file: ${err}`);
//         } else {
//             console.log('HTML file opened in the browser.');
//         }
//     });
// }

// // Call the function to open the HTML file
// openHtmlFile();


// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Wait a moment for database connection, then initialize admin
    setTimeout(() => {
        initializeAdmin();
    }, 1000);
});

module.exports = app;