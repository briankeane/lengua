---
name: create-model
description: Step-by-step workflow for creating a new Sequelize database model with migration, types, associations, and tests
---

# Database Models Conventions

## Development Workflow

1. Create the migration file
2. Create the model file with TypeScript types
3. Create the index file for re-exports
4. Register the model in `db/index.ts`
5. Add associations (if any)
6. Run migration: `make migrate-all`
7. Write tests (only for complex models)
8. Verify: `make lint-server && make build-server && make test-server`

## Directory Structure

Models live in `server/src/db/models/` with each model in its own directory:

```
server/src/db/models/
├── [modelName].model/
│   ├── [modelName].model.ts      # Main model definition
│   ├── index.ts                   # Re-exports the model
│   └── [modelName].model.test.ts  # Tests (only for complex models)
```

## Reference Implementation

Study `server/src/db/models/user.model/user.model.ts` before creating a new model. Follow the same patterns exactly.

## Creating a New Model

### 1. Create the Migration

Location: `server/src/db/migrations/[timestamp]-[description].js`

Timestamp format: `YYYYMMDDHHMMSS` (e.g., `20260301000001`)

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tableName', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
      },
      // ... other fields
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes as needed
    await queryInterface.addIndex('tableName', {
      fields: ['fieldName'],
      name: 'table_name_field_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tableName');
  },
};
```

### 2. Create the Model File

Location: `server/src/db/models/[modelName].model/[modelName].model.ts`

```typescript
import {
  Association,
  BelongsToGetAssociationMixin,
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

class ModelName extends Model<InferAttributes<ModelName>, InferCreationAttributes<ModelName>> {
  // Required fields
  declare fieldName: string;

  // Optional fields (auto-generated or with defaults)
  declare id: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Association properties (populated when included in queries)
  // declare relatedModel?: RelatedModel;

  // Association mixins
  // declare getRelatedModel: BelongsToGetAssociationMixin<RelatedModel>;
}

ModelName.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    fieldName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'modelName', // camelCase
  },
);

export default ModelName;
```

### 3. Create the Index File

Location: `server/src/db/models/[modelName].model/index.ts`

```typescript
export { default } from './modelName.model';
export { default as ModelName } from './modelName.model';
```

### 4. Register the Model

In `server/src/db/index.ts`, import and re-export the model so it's available project-wide.

### 5. Set Up Associations

Add associations directly in the model file or create `server/src/db/associations.ts` if it doesn't exist yet. Follow the commented examples in `user.model.ts`.

```typescript
ModelName.belongsTo(RelatedModel, {
  foreignKey: 'relatedModelId',
  as: 'relatedModel',
});

RelatedModel.hasMany(ModelName, {
  foreignKey: 'relatedModelId',
});
```

### 6. Add to Test Data Generator

Add a factory function in `server/src/test/testDataGenerator.ts`:

```typescript
export async function createModelName(
  db: typeof import('../db'),
  overrides: Partial<ModelNameAttributes> = {},
) {
  return db.models.ModelName.create({
    fieldName: faker.lorem.word(),
    ...overrides,
  });
}
```

## Model Testing

**Only test complex models** that have:

- Virtual properties
- Custom instance methods
- Hooks (beforeCreate, afterUpdate, etc.)
- Complex validation logic

Simple models with just data fields don't need tests.

### Test Pattern

```typescript
import { assert } from 'chai';
import db from '../..';
import { createModelName } from '../../../test/testDataGenerator';

describe('ModelName Model', function () {
  describe('customMethod', function () {
    it('returns expected value', async function () {
      const instance = await createModelName(db);
      assert.isTrue(instance.customMethod());
    });
  });
});
```

### Run Model Tests

```bash
make test-server-file GREP="ModelName Model"
```

## Common Patterns

### Enum Fields

```typescript
export const STATUS_VALUES = ["pending", "active", "completed"] as const;
export type StatusType = (typeof STATUS_VALUES)[number];

// In model init:
status: {
  type: DataTypes.ENUM(...STATUS_VALUES),
  allowNull: false,
  defaultValue: "pending",
},
```

### Nullable Foreign Keys

```typescript
relatedModelId: {
  type: DataTypes.UUID,
  allowNull: true,
  references: {
    model: "relatedModels",
    key: "id",
  },
},
```

### Uppercase Constraint (for codes)

In migration:

```javascript
await queryInterface.sequelize.query(`
  ALTER TABLE "tableName"
  ADD CONSTRAINT "tableName_code_uppercase"
  CHECK (code = UPPER(code))
`);
```

## Verification Checklist

- [ ] Migration file created with proper timestamp
- [ ] Model file created with TypeScript types
- [ ] Index file exports the model
- [ ] Model registered in `db/index.ts`
- [ ] Associations added (if applicable)
- [ ] Factory function added to `testDataGenerator.ts`
- [ ] `make migrate-all` runs successfully
- [ ] `make lint-server` passes
- [ ] `make build-server` passes
- [ ] `make test-server` passes
- [ ] Tests written (if model has complex logic)
