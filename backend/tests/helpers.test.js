const app = require('../index');

describe('Backend Helper Functions', () => {
  describe('mapBools', () => {
    const { mapBools } = app;

    it('should return null or undefined if the input object is falsy', () => {
      expect(mapBools(null, ['is_active'])).toBeNull();
      expect(mapBools(undefined, ['is_active'])).toBeUndefined();
    });

    it('should convert 1 or true to true, and other values to false, for specified keys', () => {
      const obj = {
        id: '123',
        is_active: 1,
        is_admin: 0,
        is_verified: true,
        another_val: 1 // not in keys
      };
      const result = mapBools(obj, ['is_active', 'is_admin', 'is_verified']);
      
      expect(result.is_active).toBe(true);
      expect(result.is_admin).toBe(false);
      expect(result.is_verified).toBe(true);
      expect(result.another_val).toBe(1); // untouched since it's not in keys
    });

    it('should not mutate the original object', () => {
      const obj = { is_active: 1 };
      const result = mapBools(obj, ['is_active']);
      
      expect(result.is_active).toBe(true);
      expect(obj.is_active).toBe(1);
    });
  });

  describe('mapBoolsArray', () => {
    const { mapBoolsArray } = app;

    it('should map booleans for an array of objects', () => {
      const arr = [
        { id: '1', is_active: 1, is_verified: 0 },
        { id: '2', is_active: 0, is_verified: 1 }
      ];
      const result = mapBoolsArray(arr, ['is_active', 'is_verified']);
      
      expect(result[0].is_active).toBe(true);
      expect(result[0].is_verified).toBe(false);
      expect(result[1].is_active).toBe(false);
      expect(result[1].is_verified).toBe(true);
    });
  });

  describe('generateUUID', () => {
    const { generateUUID } = app;

    it('should generate a valid UUID string format', () => {
      const uuid = generateUUID();
      expect(typeof uuid).toBe('string');
      // UUID format regex: 8-4-4-4-12 hex characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(uuid)).toBe(true);
    });

    it('should generate unique values', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});
