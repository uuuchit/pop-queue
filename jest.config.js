module.exports = {
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: ['/node_modules/(?!axios)',],
  globals: {
    'babel-jest': {
      useESM: true,
    },
  },
};
