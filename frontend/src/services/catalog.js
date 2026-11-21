const input = (name, label, type = 'text', extra = {}) => ({
  name,
  label,
  type,
  required: true,
  ...extra,
})
const text = input('description', 'Description', 'textarea')
const title = input('title', 'Title')
const optional = { required: false }
const flag = (name, label) => input(name, label, 'checkbox', optional)
const source = (name, label, endpoint, extra = {}) =>
  input(name, label, 'select', { endpoint, ...extra })
const options = (name, label, choices) =>
  input(name, label, 'select', { choices })
const image = input('image', 'Image (JPEG, PNG or WebP, up to 5 MB)', 'file', {
  ...optional,
  accept: 'image/jpeg,image/png,image/webp',
})
export const catalog = {
  announcements: {
    api: 'announcements',
    path: 'announcements',
    name: 'Announcements',
    singular: 'Announcement',
    group: 'Organization',
    description: 'News, reminders and updates from DLL Elite.',
    fields: [
      title,
      text,
      input('category', 'Category'),
      options('status', 'Status', ['draft', 'published', 'archived']),
      flag('pinned', 'Pin announcement'),
      input('expires', 'Expiration date', 'date', optional),
      image,
      input('attachment', 'PDF attachment (up to 5 MB)', 'file', {
        ...optional,
        accept: 'application/pdf',
      }),
    ],
  },
  activities: {
    api: 'activities',
    path: 'organization-activities',
    name: 'Organization Activities',
    singular: 'Activity',
    group: 'Organization',
    description: 'Follow club initiatives from planning through completion.',
    fields: [
      title,
      text,
      input('start_date', 'Start date', 'date'),
      input('end_date', 'End date', 'date'),
      flag('published', 'Publish activity'),
      image,
    ],
  },
  events: {
    api: 'events',
    path: 'weekly-events',
    name: 'Weekly Events',
    singular: 'Event',
    group: 'Organization',
    fields: [
      title,
      text,
      source('venue', 'Venue', 'venue-options/'),
      input('date', 'Event date', 'date'),
      input('start', 'Start time (Manila)', 'time'),
      input('end', 'End time (Manila)', 'time'),
      flag('cancelled', 'Cancel event'),
      source('activity', 'Related activity', 'activities/?manage=1', optional),
      flag('published', 'Publish event'),
      image,
    ],
  },
  teams: {
    api: 'teams',
    path: 'organization-teams',
    name: 'Organization Teams',
    singular: 'Team',
    group: 'Organization',
    description: 'Meet the teams behind DLL Elite programs and events.',
    fields: [
      input('name', 'Team name'),
      text,
      flag('is_active', 'Team active'),
    ],
  },
  links: {
    api: 'links',
    path: 'useful-links',
    name: 'Useful Links',
    singular: 'Link',
    group: 'Organization',
    description: 'Resources collected by the organization.',
    fields: [
      title,
      input('url', 'Web address', 'url'),
      input('category', 'Category'),
      { ...text, required: false },
      flag('is_public', 'Show on Student Access'),
    ],
  },
  venues: {
    api: 'venues',
    path: 'venues',
    name: 'Venues',
    singular: 'Venue',
    group: 'Venue desk',
    description: 'Explore campus spaces, locations and capacities.',
    fields: [
      input('name', 'Venue name'),
      input('location', 'Location'),
      input('capacity', 'Capacity', 'number'),
      { ...text, required: false },
      flag('available', 'Venue active'),
    ],
  },
  notices: {
    api: 'notices',
    path: 'venue-notices',
    name: 'Venue Notices',
    singular: 'Notice',
    group: 'Venue desk',
    description: 'Current restrictions, closures and scheduling updates.',
    fields: [
      title,
      text,
      source('venue', 'Venue', 'venue-options/'),
      input('starts_at', 'Starts (Manila time)', 'datetime-local'),
      input('ends_at', 'Ends (Manila time)', 'datetime-local'),
      options('publication_status', 'Publication status', [
        'draft',
        'published',
        'archived',
      ]),
    ],
  },
  accounts: {
    api: 'accounts',
    path: 'accounts',
    name: 'Account Management',
    singular: 'Account',
    group: 'Administration',
    private: true,
    fields: [
      input('full_name', 'Full name'),
      input('username', 'Username'),
      input('email', 'Email', 'email', optional),
      options('role', 'Organization role', ['staff', 'officer']),
      input('position', 'Position', 'text', optional),
      input('teams', 'Assigned teams', 'team-checkboxes'),
      input('contact', 'Contact information', 'text', optional),
      flag('is_active', 'Account active'),
      input(
        'password',
        'Initial or replacement password',
        'password',
        optional,
      ),
    ],
  },
}
