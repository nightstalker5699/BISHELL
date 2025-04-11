const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // User who is submitting (student)
    required: true
  },
  realName: {
    type: String,
    required: true  // field for students to provide their real name
  },
  file: {
    type: String,  // Store file URL or path
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'  // Status starts as 'pending'
  },
  feedback: {
    type: String,
    required: false  // Feedback from the professor if the submission is rejected
  },
  group: {
    type: String,
    required: false  // Optional field for group assignment (e.g., A, B, C, D)
  }
});

// Indexes to speed up queries for a given assignment and student
submissionSchema.index({ assignmentId: 1, studentId: 1 });

const Submission = mongoose.model('Submission', submissionSchema);

module.exports = Submission;
