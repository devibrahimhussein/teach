/* Tutoring services — the offerings from the printed flyers.

   These are distinct from the two exercise courses: a service describes what is
   taught and how it is delivered, and ends in a WhatsApp CTA.
   Add another flyer by pushing a second object with the same shape. */

window.CONTACT = {
  whatsapp: '96176614115',      // wa.me form: country code, no + and no spaces
  display: '76 614 115',
  name: 'Mr. Ibrahim Hussein',
  place: 'Beirut · Live or Online'
};

/* The Programming & OOP offering. Shaped to match a service below — title, what it
   covers, CTA — so both offerings render as the same kind of block on the home page.
   What it covers is the course grid itself, built from data/courses.js.
   No prices are published on the site: they are agreed over WhatsApp. */
window.CoursePricing = {
  title: 'Programming & OOP',
  coursesLabel: 'Choose a course',
  cta: {
    label: 'Chat on WhatsApp',
    message: 'Hi Mr. Ibrahim, I am interested in Programming & OOP tutoring.'
  }
};

window.Services = [
  {
    id: 'bt3-it',
    eyebrow: 'Private Tutoring',
    title: 'BT3',
    titleAccent: 'IT',
    lede: 'Complete subject support for Baccalaureate Technique — Information Technology.',

    subjectsLabel: 'All subjects covered',
    subjects: [
      'Networking',
      'Assembly',
      'Technology',
      'Access',
      'Mathematics',
      'C Language',
      'Operating Systems',
      'Maintenance'
    ],

    deliveryLabel: 'Available as',
    delivery: ['Live Sessions', 'Online'],

    /* summary row under the buttons, mirroring the hero's stats */
    stats: [
      ['8', 'subjects covered'],
      ['2', 'hours per session'],
      ['16', 'hours per month'],
      ['Live', 'or online']
    ],

    cta: {
      label: 'Chat on WhatsApp',
      message: 'Hi Mr. Ibrahim, I am interested in BT3 IT tutoring.'
    }
  }
];
