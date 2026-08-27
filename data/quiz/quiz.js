/* ==========================================================================
   Evaluation-test registry.
   Loaded before every question bank. Plain script, no modules, works from file://

   A topic is one curriculum objective plus the questions that test it:
     Quiz.addTopic('fundamentals', { module: 1, objective: 'Data Types',
                                     questions: [ ... ] });

   Topics keep the order they are declared in, which is curriculum order.

   A bank is declared here with its size and left on disk until the test is opened
   — `Quiz.load` fetches it. The course page only needs the two counts, and the
   fundamentals bank alone is ~36 KB of JavaScript nobody browsing courses reads.
   ========================================================================== */

window.Quiz = (function () {
  var banks = {};
  var declared = {};

  function topics(courseId) { return banks[courseId] || []; }

  return {
    /* { questions, topics, src } — the counts shown before the bank is fetched. */
    declare: function (courseId, manifest) { declared[courseId] = manifest; },

    /* Fetches the question bank once, then calls back with whether it is ready. */
    load: function (courseId, done) {
      if (banks[courseId]) return done(true);
      var manifest = declared[courseId];
      if (!manifest) return done(false);
      loadScript(manifest.src, function (ok) { done(ok && !!banks[courseId]); });
    },

    addTopic: function (courseId, topic) {
      if (!banks[courseId]) banks[courseId] = [];
      /* the id survives edits to the wording, so saved progress stays meaningful */
      topic.id = 'm' + topic.module + '-o' + (banks[courseId].filter(function (t) {
        return t.module === topic.module;
      }).length + 1);
      banks[courseId].push(topic);
      return topic;
    },

    topics: topics,

    has: function (courseId) {
      return topics(courseId).length > 0 || !!declared[courseId];
    },

    countTopics: function (courseId) {
      return topics(courseId).length || (declared[courseId] || {}).topics || 0;
    },

    countQuestions: function (courseId) {
      if (!banks[courseId]) return (declared[courseId] || {}).questions || 0;
      return topics(courseId).reduce(function (n, t) { return n + t.questions.length; }, 0);
    },

    /* Modules covered, in order, with their topic counts. */
    modules: function (courseId) {
      var seen = [], byNumber = {};
      topics(courseId).forEach(function (t) {
        if (!byNumber[t.module]) {
          byNumber[t.module] = { number: t.module, topics: [] };
          seen.push(byNumber[t.module]);
        }
        byNumber[t.module].topics.push(t);
      });
      return seen;
    },

    /* Every question, flattened, each one carrying the topic it belongs to. */
    questions: function (courseId) {
      var out = [];
      topics(courseId).forEach(function (t) {
        t.questions.forEach(function (q, i) {
          out.push({ q: q, topic: t, qid: t.id + '-q' + (i + 1) });
        });
      });
      return out;
    }
  };
})();

/* Deferred question banks. Keep the counts in step with the file behind `src`. */
Quiz.declare('fundamentals', {
  questions: 66, topics: 22, src: 'data/quiz/fundamentals.js'
});
