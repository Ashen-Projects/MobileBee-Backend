import { randomInt } from 'node:crypto';

const CHARACTER_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%^&*',
] as const;

const ALL_CHARACTERS = CHARACTER_GROUPS.join('');

const pick = (characters: string): string => characters[randomInt(characters.length)];

export const generateSecurePassword = (length = 16): string => {
  if (length < 12) throw new Error('Generated passwords must contain at least 12 characters.');

  const characters = CHARACTER_GROUPS.map(pick);
  while (characters.length < length) characters.push(pick(ALL_CHARACTERS));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join('');
};
