import { randomInt } from 'node:crypto';

const CHARACTER_GROUPS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%^&*',
] as const;

const ALL_CHARACTERS = CHARACTER_GROUPS.join('');
const TEMPORARY_PASSWORD_LENGTH = 6;

const pick = (characters: string): string => characters[randomInt(characters.length)];

export const generateSecurePassword = (): string => {
  const characters = CHARACTER_GROUPS.map(pick);
  while (characters.length < TEMPORARY_PASSWORD_LENGTH) characters.push(pick(ALL_CHARACTERS));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }

  return characters.join('');
};
