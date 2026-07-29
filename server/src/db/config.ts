/*
 * This is only for cli migrations -- not used by the actual app.
 */

interface DBConfig {
  url: string;
  dialect: string;
  database: string;
  logging?: boolean | ((sql: string, timing?: number) => void);
  ssl?: boolean;
  dialectOptions?: {
    ssl?: {
      require: boolean;
      rejectUnauthorized: boolean;
    };
  };
}

interface DBConfigMap {
  [key: string]: DBConfig;
}

const config: DBConfigMap = {
  development: {
    url: process.env.DATABASE_URL as string,
    dialect: 'postgres',
    // the database name must be provided for sequelize-cli,
    // even though it is included in the url
    database: (process.env.DATABASE_URL as string).split('/').slice(-1)[0],
  },
  test: {
    url: process.env.DATABASE_URL as string,
    dialect: 'postgres',
    logging: false,
    database: (process.env.DATABASE_URL as string).split('/').slice(-1)[0],
  },
  production: {
    url: `${process.env.DATABASE_URL}`,
    dialect: 'postgres',
    ssl: true,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, //https://github.com/brianc/node-postgres/issues/2009#issuecomment-556020509
      },
    },
    database: (process.env.DATABASE_URL as string).split('/').slice(-1)[0],
  },
};

// For ES Module import
export default config;
module.exports = config;
