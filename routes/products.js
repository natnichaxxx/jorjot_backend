const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product.js');

//อ่านค่า
router.get('/', async (req, res) => { 
    try {
      const products = await Product.find(); // ดึงข้อมูลจาก MongoDB
      res.json(products);
    } catch (err) {
      console.error('Error in GET /products:', err); // Log error
      res.status(500).json({ error: err.message });
    }
  }); 

//อ่าน ID
router.get('/:id', async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (err) {
        console.error('Error in GET /products/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

//เพิ่มค่า
router.post('/', async (req, res, next) => {
    try {
        const newProduct = await Product.create(req.body); // ใช้ async/await
        res.json(newProduct);
    } catch (err) {
        console.error('Error in POST /products:', err); // Log error
        res.status(500).json({ error: err.message });
    }
});

//เปลี่ยนค่า
router.put('/:id', async (req, res, next) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true } // ส่งคืนค่าที่อัปเดตและตรวจสอบ validation
        );
        if (!updatedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(updatedProduct);
    } catch (err) {
        console.error('Error in PUT /products/:id:', err);
        res.status(500).json({ error: err.message });
    }
});

//ลบค่า
router.delete('/:id', async (req, res, next) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ message: 'Product deleted', deletedProduct });
    } catch (err) {
        console.error('Error in DELETE /products/:id:', err);
        res.status(500).json({ error: err.message });
    }
});


module.exports = router