var coursesData = require('./data')

var updateCourse = function ({ id, input }) {
    coursesData.map(course => {
        if (course.id === id) {
            course.title = input.title
            course.author = input.author
            course.description = input.description
            course.topic = input.topic;
            course.url = input.url
            return course;
        }
    });
    return coursesData.filter(course => course.id === id)[0];
}

var createCourse = function ({ input }) {
    var id = Math.max(...coursesData.map(course => course.id)) + 1
    const newCourse = {
        id,
        ...input
    }
    coursesData.push(newCourse)
    return newCourse
}

var deleteCourse = function ({ id }) {
    const newCourses = [...coursesData.filter(course => course.id !== id)];
    coursesData = newCourses
    return coursesData;
}

var getCourse = function (args) {
    var id = args.id;
    return coursesData.filter(course => {
        return course.id == id;
    })[0];
}

var getCourses = function (args) {
    if (args.topic) {
        var topic = args.topic;
        return coursesData.filter(course => course.topic === topic);
    } else {
        return coursesData;
    }
}

module.exports = {
    course: getCourse,
    courses: getCourses,
    updateCourse: updateCourse,
    createCourse: createCourse,
    deleteCourse: deleteCourse
};