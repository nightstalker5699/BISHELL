const mongoose = require('mongoose');
const User = require('./userModel');
const courseSchema = new mongoose.Schema({

    courseName : {
        type: String,
        required: [true, 'A course must have a name'],
        unique: true
    },

    description: {
        type: String,
        required: [false]
    },

    instructorName: {
        type: String,
        required: [true, 'A course must have an instructor name'] // if no instructor atleast there's a name
    },
    
    instructorId: { type: mongoose.Schema.Types.ObjectId, ref: "User",
        validate: {
            validator: async function(value) {
                const user = await User.findById(value);
                return user && user.role === 'instructor';
            },
            message: 'Instructor ID must belong to a user with the role "instructor".'
        }
     },
    studentsId: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
})

const Course = mongoose.model("Course", courseSchema)

module.exports = Course