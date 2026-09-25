import { ApiProperty } from '@nestjs/swagger';
import {
  SETTING_EFFECTS,
  SETTING_VALUE_TYPES,
  type SettingEffect,
  type SettingValueType,
} from '../settings-catalog';

export class SettingOptionDto {
  @ApiProperty()
  value!: string;

  @ApiProperty()
  label!: string;
}

export class SettingGroupDto {
  @ApiProperty({ example: 'email' })
  id!: string;

  @ApiProperty({ example: 'Email (SMTP)' })
  label!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Warning a client should show above the whole group, when there is one.',
  })
  notice!: string | null;
}

export class SettingCatalogEntryDto {
  @ApiProperty({ example: 'smtp.host' })
  key!: string;

  @ApiProperty({ example: 'email', description: 'Id of the group this setting belongs to.' })
  group!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: SETTING_VALUE_TYPES })
  type!: SettingValueType;

  @ApiProperty({
    nullable: true,
    description: 'Value that applies when no row exists. Null means the consumer decides.',
  })
  defaultValue!: unknown;

  @ApiProperty({ type: [SettingOptionDto], nullable: true })
  options!: SettingOptionDto[] | null;

  @ApiProperty({
    enum: ['SITES'],
    nullable: true,
    description: 'When set, the client fills the choices from that resource instead.',
  })
  optionsSource!: 'SITES' | null;

  @ApiProperty({
    enum: SETTING_EFFECTS,
    description:
      'APPLIED: something in Neriva reads this value today. STORED: kept for a feature that does not exist yet.',
  })
  effect!: SettingEffect;

  @ApiProperty({
    description: 'Plain sentence naming where the value takes effect, or why it does not.',
  })
  effectNote!: string;

  @ApiProperty({ type: String, nullable: true })
  placeholder!: string | null;

  @ApiProperty({ description: 'Whether the value is redacted from API responses.' })
  isSensitive!: boolean;

  @ApiProperty({ description: 'Whether a row exists for this key.' })
  isSet!: boolean;

  @ApiProperty({
    nullable: true,
    description: 'Stored value. Null when the setting is unset or sensitive.',
  })
  value!: unknown | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  updatedAt!: string | null;
}

export class SettingsCatalogDto {
  @ApiProperty({ type: [SettingGroupDto] })
  groups!: SettingGroupDto[];

  @ApiProperty({ type: [SettingCatalogEntryDto] })
  settings!: SettingCatalogEntryDto[];
}
