---
sessionId: session-260822-014053-1cf1
---

# Requirements

### Overview & Goals
Migrate the storage architecture to use the native ClickHouse `jbod_policy` for improved reliability and performance. This involves removing the custom `DecentralizedCoordinator` and leveraging ClickHouse's built-in volume management.

### Scope
- **In Scope**:
  - Define disk paths in `volumes.toml`.
  - Configure ClickHouse `storage_configuration` in `config.d/storage.xml`.
  - Update all ClickHouse queries to use `SETTINGS storage_policy = 'jbod_policy'`.
  - Remove `DecentralizedCoordinator` and `dataset_coordination` table usage.
- **Out of Scope**:
  - Any UI changes.
  - Business logic changes unrelated to data storage.

### User Stories
- **As an admin**, I want the system to handle data storage distribution natively via ClickHouse JBOD policy so that I don't have to manage a custom coordinator.
- **As a developer**, I want to define my disk configuration in a clear `volumes.toml` file to make deployment more flexible.

### Functional Requirements
1. **Dynamic Storage Configuration**: Disk paths must be defined in `volumes.toml` and loaded by the application.
2. **Native JBOD Support**: ClickHouse must be configured to use a `jbod_policy` covering all defined disks.
3. **Query Enhancement**: All relevant queries must explicitly utilize `SETTINGS storage_policy = 'jbod_policy'`.
4. **Coordinator Decommissioning**: All traces of `DecentralizedCoordinator` must be removed from the codebase.

# Technical Design

### Current Implementation
The system currently uses a custom `DecentralizedCoordinator` (with references but no file found) for data routing, binding entries to specific ClickHouse nodes/disks.

### Key Decisions
- **Transition to ClickHouse Native JBOD**: Using `storage_configuration` for robust disk management instead of application-level coordination.
- **`volumes.toml` Configuration**: Centralizing disk path definitions.
- **Removal of `DecentralizedCoordinator`**: Simplifying the architecture by relying on ClickHouse's native capabilities.

### Proposed Changes
1. **Infrastructure**:
   - Create `config.d/storage.xml` with disk/policy configuration.
   - Create `volumes.toml` with disk paths.
2. **Application**:
   - Update `src/servers/config.ts` to load `volumes.toml`.
   - Update `src/query/sources/clickHouse.ts` to include `storage_policy` in queries.
   - Remove `DecentralizedCoordinator` references from `src/query/dataserver.ts`, `src/servers/migration.ts`, and `index.ts`.
   - Cleanup `src/servers/migration.ts` to remove `dataset_coordination` initialization.

### File Structure
- **New**: `volumes.toml`, `config.d/storage.xml`.
- **Modified**: `src/servers/config.ts`, `src/query/sources/clickHouse.ts`, `src/query/dataserver.ts`, `src/servers/migration.ts`, `index.ts`.
- **Removed**: Any file implementing `DecentralizedCoordinator` if it exists, and all references to it in the codebase.

# Testing

### Validation Approach
- Verify `volumes.toml` exists and is correctly parsed by `src/servers/config.ts`.
- Verify ClickHouse receives the correct `storage_configuration` from `config.d/storage.xml`.
- Ensure all queries initiated by the application include `SETTINGS storage_policy = 'jbod_policy'`.
- Confirm that `DecentralizedCoordinator` and `dataset_coordination` table references are completely removed from the code.
- Run existing tests to ensure no regressions in basic ClickHouse functionality.

# Delivery Steps

### ✓ Step 1: Configure JBOD storage policy and volumes.toml
Implement JBOD storage configuration and update application config.
- Create `volumes.toml` with `default` and `disk2` paths.
- Add `config.d/storage.xml` with `<storage_configuration>` and `<jbod_policy>` defining `main` volume with `default` and `disk2`.
- Update `src/servers/config.ts` to parse `volumes.toml`.

### ✓ Step 2: Update queries and remove coordinator
Refactor ClickHouse queries and decommission coordinator service.
- Modify `src/query/sources/clickHouse.ts` to append `SETTINGS storage_policy = 'jbod_policy'` to queries.
- Remove `DecentralizedCoordinator` imports and usage from `src/query/dataserver.ts`, `src/servers/migration.ts`, and `index.ts`.
- Update `src/servers/migration.ts` to remove `dataset_coordination` table initialization/sync logic.