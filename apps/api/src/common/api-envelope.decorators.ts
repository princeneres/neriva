import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

// Documents the { data } success envelope around a model.
export function ApiDataResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: { status?: number } = {},
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: options.status ?? 200,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}

// Documents the { data: [], meta: { cursor, limit } } list envelope.
export function ApiListResponse<TModel extends Type<unknown>>(model: TModel) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: 200,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: {
            type: 'object',
            required: ['cursor', 'limit'],
            properties: {
              cursor: { type: 'string', nullable: true },
              limit: { type: 'number' },
            },
          },
        },
      },
    }),
  );
}
