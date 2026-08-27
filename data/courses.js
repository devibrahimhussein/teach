/* ==========================================================================
   Curriculum registry.
   Loaded before every data file. Plain script, no modules, works from file://

   Modules come in two stages. `declareModules` registers a cheap stub — number,
   title, summary and the exercise count — which is everything the course list and
   the home page need. The heavy file that carries the objectives, examples and
   exercises is fetched only when its module page is opened, through `loadModule`.
   Keeping all five fundamentals files out of the first load takes ~190 KB of
   parser-blocking JavaScript off every visit that never opens a module.
   ========================================================================== */

window.Curriculum = (function () {
  var courses = [];
  var byId = {};

  /* Copies a loaded module's fields onto its stub, so anything already holding a
     reference to the stub (the sidebar, the pager) sees the full module. */
  function fill(stub, mod) {
    for (var k in mod) if (Object.prototype.hasOwnProperty.call(mod, k)) stub[k] = mod[k];
    return stub;
  }

  function find(courseId, number) {
    var course = byId[courseId];
    if (!course) return null;
    for (var i = 0; i < course.modules.length; i++) {
      if (course.modules[i].number === Number(number)) return course.modules[i];
    }
    return null;
  }

  return {
    addCourse: function (course) {
      course.modules = [];
      courses.push(course);
      byId[course.id] = course;
      return course;
    },

    /* Stubs for modules whose content lives in its own file.
       Each entry: { number, title, summary, exercises, src } */
    declareModules: function (courseId, stubs) {
      var course = byId[courseId];
      if (!course) throw new Error('Unknown course: ' + courseId);
      stubs.forEach(function (s) {
        s.deferred = true;
        course.modules.push(s);
      });
      course.modules.sort(function (a, b) { return a.number - b.number; });
    },

    addModule: function (courseId, mod) {
      var course = byId[courseId];
      if (!course) throw new Error('Unknown course: ' + courseId);
      var stub = find(courseId, mod.number);
      if (stub) {                       /* the deferred file has arrived */
        fill(stub, mod);
        stub.deferred = false;
        return stub;
      }
      course.modules.push(mod);
      course.modules.sort(function (a, b) { return a.number - b.number; });
      return mod;
    },

    /* Fetches a deferred module's file once, then calls back. Callers that hit an
       already-loaded module are called back synchronously. */
    loadModule: function (courseId, number, done) {
      var mod = find(courseId, number);
      if (!mod || !mod.deferred) return done(mod);
      loadScript(mod.src, function (ok) { done(ok ? find(courseId, number) : null); });
    },

    allCourses: function () { return courses; },

    getCourse: function (id) { return byId[id] || null; },

    getModule: find,

    /* A stub carries the count as a number; a loaded module is counted from its
       objectives, so the two can never drift apart silently. */
    moduleExercises: function (mod) {
      if (!mod) return 0;
      if (mod.objectives) {
        return mod.objectives.reduce(function (n, o) {
          return n + ((o.exercises || []).length);
        }, 0);
      }
      return mod.exercises || 0;
    },

    /* Counts only modules that actually carry exercises. */
    countExercises: function (course) {
      var self = this;
      return (course.modules || []).reduce(function (n, m) {
        return n + self.moduleExercises(m);
      }, 0);
    }
  };
})();

/* --------------------------------------------------------------------------
   Starter-code templates.
   An exercise declares what it needs; the renderer builds the skeleton.
     cpp:  { includes: ['<iomanip>'], notes: [...] }
     java: { scanner: true, notes: [...] }
   Either side may supply `starter` to override the generated skeleton.
   -------------------------------------------------------------------------- */

window.starterCpp = function (includes) {
  var headers = ['<iostream>'].concat(includes || []);
  var lines = headers.map(function (h) { return '#include ' + h; });
  lines.push('using namespace std;');
  lines.push('');
  lines.push('int main() {');
  lines.push('    // your code here');
  lines.push('');
  lines.push('    return 0;');
  lines.push('}');
  return lines.join('\n');
};

window.starterJava = function (scanner) {
  var lines = [];
  if (scanner) { lines.push('import java.util.Scanner;'); lines.push(''); }
  lines.push('public class Main {');
  lines.push('    public static void main(String[] args) {');
  if (scanner) lines.push('        Scanner sc = new Scanner(System.in);');
  lines.push('        // your code here');
  lines.push('    }');
  lines.push('}');
  return lines.join('\n');
};

/* --------------------------------------------------------------------------
   Courses
   -------------------------------------------------------------------------- */

Curriculum.addCourse({
  id: 'fundamentals',
  title: 'Programming Fundamentals',
  subtitle: 'Course 1',
  description:
    'Variables, input and output, conditions, arrays, and functions. Every objective is ' +
    'followed by three exercises that reuse the same concept in a different scenario.',
  rules: [
    'Read the input values in exactly the order the exercise states.',
    'Do not print prompt messages such as "Enter a number". The sample output shows every line your program is expected to print, and nothing else.',
    'Match labels, spacing and punctuation exactly as written in the Output section.',
    'Assume the input is valid unless the exercise explicitly asks you to validate it.',
    'Solve each exercise on your own. This platform gives requirements, examples and rules, never solutions.'
  ]
});

Curriculum.addCourse({
  id: 'oop',
  title: 'Object-Oriented Programming',
  subtitle: 'Course 2',
  description:
    'Classes, objects, encapsulation, inheritance, interface, polymorphism and abstraction, ' +
    'built on top of Programming Fundamentals.',
  rules: [
    'Programming Fundamentals is a prerequisite for this course.',
    'Read the input values in exactly the order the exercise states.',
    'Match labels, spacing and punctuation exactly as written in the Output section.',
    'Solve each exercise on your own. This platform gives requirements, examples and rules, never solutions.'
  ]
});

/* --------------------------------------------------------------------------
   Deferred module files.
   Each stub carries what the course list and the home page need; the file named
   by `src` is fetched the first time its module page is opened. Keep `exercises`
   in step with the file when exercises are added or removed — the course page
   shows this number, and the module page recounts from the file once loaded.
   -------------------------------------------------------------------------- */

Curriculum.declareModules('fundamentals', [
  { number: 1, title: 'Basics',
    summary: 'Data types, reading input, printing output, arithmetic, and operator precedence.',
    exercises: 12, src: 'data/fundamentals/m1.js' },
  { number: 2, title: 'Conditions',
    summary: 'Making decisions with if, if/else, logical operators, validation, nesting and switch/case.',
    exercises: 27, src: 'data/fundamentals/m2.js' },
  { number: 3, title: 'Loops',
    summary: 'Repeating work with do/while, while and for, then combining loops for number algorithms and nested data.',
    exercises: 15, src: 'data/fundamentals/m3.js' },
  { number: 4, title: 'Arrays',
    summary: 'Storing many values in one variable: initialising, filling, displaying and analysing arrays.',
    exercises: 12, src: 'data/fundamentals/m4.js' },
  { number: 5, title: 'Functions',
    summary: 'Splitting a program into named blocks: returning values, acting without returning, passing arrays, and functions that call themselves.',
    exercises: 18, src: 'data/fundamentals/m5.js' }
]);
