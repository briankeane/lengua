import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
} from 'sequelize';
import sequelize from '../../sequelize';

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare firstName: string;
  declare lastName: CreationOptional<string>;
  declare displayName: CreationOptional<string>;
  declare email: string;
  declare verifiedEmail: CreationOptional<string>;
  declare passwordHash: CreationOptional<string>;
  declare profileImageUrl: CreationOptional<string>;
  declare role: CreationOptional<'admin' | 'user' | 'guest'>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  jwtRepr() {
    return {
      id: this.id.toString(),
      firstName: this.firstName,
      lastName: this.lastName,
      displayName: this.displayName,
      email: this.email,
      profileImageUrl: this.profileImageUrl,
      role: this.role,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      autoIncrement: false,
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: DataTypes.STRING,
    displayName: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    verifiedEmail: DataTypes.STRING,
    passwordHash: DataTypes.STRING,
    profileImageUrl: DataTypes.STRING,
    role: {
      type: DataTypes.ENUM('admin', 'user', 'guest'),
      allowNull: false,
      defaultValue: 'user',
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'user',
  },
);

export default User;
