
const adjectives = [
  'Brave', 'Swift', 'Mighty', 'Clever', 'Bold', 'Quick', 'Strong', 'Wise',
  'Fast', 'Sharp', 'Bright', 'Smart', 'Cool', 'Epic', 'Wild', 'Fire',
  'Ice', 'Storm', 'Thunder', 'Lightning', 'Shadow', 'Mystic', 'Magic',
  'Cyber', 'Neon', 'Plasma', 'Quantum', 'Digital', 'Ultra', 'Mega'
];

const nouns = [
  'Warrior', 'Hunter', 'Knight', 'Wizard', 'Ninja', 'Samurai', 'Ranger',
  'Guardian', 'Champion', 'Hero', 'Legend', 'Master', 'Ace', 'Star',
  'Wolf', 'Eagle', 'Tiger', 'Dragon', 'Phoenix', 'Falcon', 'Lion',
  'Blob', 'Sphere', 'Orb', 'Node', 'Core', 'Unit', 'Entity', 'Agent'
];

export function generateName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective}${noun}${number}`;
}
