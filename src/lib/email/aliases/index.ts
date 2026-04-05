/**
 * Email Aliases Module
 * Exports all alias-related services and types
 */

export {
  AliasService,
  getAliasService,
  type AliasType,
  type EmailAlias,
  type SharedMailboxType,
  type MailboxPermission,
  type SharedMailbox,
  type SharedMailboxAccess,
  type DistributionListType,
  type DistributionList,
  type DelegationPermission,
  type EmailDelegation,
  type CreateAliasParams,
  type CreateSharedMailboxParams,
  type CreateDistributionListParams,
  type CreateDelegationParams,
} from './alias-service';
