import { Sequelize } from 'sequelize';
import config from '../config';
import DBConfig from './config';

if (!config.NODE_ENV) {
  throw new Error('NODE_ENV is not defined');
}

const dbConfigForThisEnv = DBConfig[config.NODE_ENV];
if (!dbConfigForThisEnv) {
  throw new Error(`No database configuration found for environment: ${config.NODE_ENV}`);
}

// Extract the URL and remove it from the options to avoid duplicate URL in constructor
const { url, ...otherOptions } = dbConfigForThisEnv;

// Create sequelize instance with proper typing
const sequelize = new Sequelize(url, {
  ...otherOptions,
  dialect: 'postgres', // Add explicit dialect since it's required by the type
});

// For ES Module import
export default sequelize;

module.exports = sequelize;
