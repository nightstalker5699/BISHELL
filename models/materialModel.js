const path = require('path');
const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['file', 'folder'], 
    required: true 
  },
  path: { 
    type: String, 
    required: true 
  },
  filePath: { 
    type: String,
    set: function(v) {
      return path.normalize(v);
    }
  },
  size: { 
    type: Number,
    required: function() { 
      return this.type === 'file'; 
    }
  },
  mimeType: {
    type: String,
    required: function() { 
      return this.type === 'file'; 
    }
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',  
    required: true
  },
  parentFolder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for human readable size
materialSchema.virtual('humanSize').get(function() {
  if (this.type !== 'file') return null;
  const units = ['B', 'KB', 'MB'];
  let size = this.size;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
});

// Add index for common queries
materialSchema.index({ course: 1, path: 1 });
materialSchema.index({ parentFolder: 1 });

module.exports = mongoose.model('Material', materialSchema);