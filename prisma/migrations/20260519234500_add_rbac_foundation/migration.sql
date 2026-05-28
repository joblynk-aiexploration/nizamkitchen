-- CreateEnum
CREATE TYPE "PermissionAction" AS ENUM ('create', 'read', 'update', 'delete', 'archive', 'restore', 'approve', 'reject', 'export', 'manage', 'configure', 'impersonate_placeholder', 'refund', 'payout', 'verify', 'moderate');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('platform', 'organization', 'country');

-- ExtendEnum: OrganizationRole
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'household_member';
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'home_catering_owner';
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'home_catering_staff';

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "action" "PermissionAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleScope" "RoleScope" NOT NULL,
    "roleName" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");
CREATE INDEX "Permission_module_idx" ON "Permission"("module");
CREATE INDEX "Permission_action_idx" ON "Permission"("action");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleScope_roleName_permissionId_key" ON "RolePermission"("roleScope", "roleName", "permissionId");
CREATE INDEX "RolePermission_roleScope_roleName_idx" ON "RolePermission"("roleScope", "roleName");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permissionId_key" ON "UserPermissionOverride"("userId", "permissionId");
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");
CREATE INDEX "UserPermissionOverride_createdById_idx" ON "UserPermissionOverride"("createdById");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
