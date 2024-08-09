import 'dotenv/config';
import * as joi from 'joi';

interface IEnvs {
  PORT: number;
  STRIPE_CANCEL_URL: string;
  STRIPE_ENDPOINT_SECRET: string;
  STRIPE_SECRET: string;
  STRIPE_SUCCESS_URL: string;
}

const schema = joi
  .object({
    PORT: joi.number().default(3000),
    STRIPE_CANCEL_URL: joi.string().required(),
    STRIPE_ENDPOINT_SECRET: joi.string().required(),
    STRIPE_SECRET: joi.string().required(),
    STRIPE_SUCCESS_URL: joi.string().required(),
  })
  .unknown();

const { error, value } = schema.validate(process.env);

if (error) throw new Error(error.message);

const envs: IEnvs = value;

export { envs };
