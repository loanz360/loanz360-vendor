/**
 * Tests for role configuration and hierarchy
 */

type UserRole = 'SUPERADMIN' | 'ADMIN' | 'HR' | 'ACCOUNTS_MANAGER' | 'BDM' | 'CPE' | 'CRO' | 'DSE' | 'EMPLOYEE' | 'PARTNER' | 'VENDOR' | 'CUSTOMER'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPERADMIN: 100,
  ADMIN: 90,
  HR: 70,
  ACCOUNTS_MANAGER: 70,
  BDM: 60,
  CPE: 50,
  CRO: 50,
  DSE: 40,
  EMPLOYEE: 30,
  PARTNER: 20,
  VENDOR: 20,
  CUSTOMER: 10,
}

function canAccess(userRole: UserRole, requiredLevel: number): boolean {
  return ROLE_HIERARCHY[userRole] >= requiredLevel
}

function isInternalRole(role: UserRole): boolean {
  return !['PARTNER', 'VENDOR', 'CUSTOMER'].includes(role)
}

describe('Role hierarchy', () => {
  test('SUPERADMIN has highest level', () => {
    expect(ROLE_HIERARCHY.SUPERADMIN).toBe(100)
    Object.entries(ROLE_HIERARCHY).forEach(([role, level]) => {
      if (role !== 'SUPERADMIN') {
        expect(level).toBeLessThan(100)
      }
    })
  })

  test('ADMIN is second highest', () => {
    expect(ROLE_HIERARCHY.ADMIN).toBe(90)
  })

  test('CUSTOMER has lowest level', () => {
    expect(ROLE_HIERARCHY.CUSTOMER).toBe(10)
  })

  test('all roles have defined levels', () => {
    const roles: UserRole[] = ['SUPERADMIN','ADMIN','HR','ACCOUNTS_MANAGER','BDM','CPE','CRO','DSE','EMPLOYEE','PARTNER','VENDOR','CUSTOMER']
    roles.forEach(role => {
      expect(ROLE_HIERARCHY[role]).toBeDefined()
      expect(ROLE_HIERARCHY[role]).toBeGreaterThan(0)
    })
  })
})

describe('canAccess', () => {
  test('SUPERADMIN can access everything', () => {
    expect(canAccess('SUPERADMIN', 100)).toBe(true)
    expect(canAccess('SUPERADMIN', 10)).toBe(true)
  })

  test('CUSTOMER cannot access admin routes', () => {
    expect(canAccess('CUSTOMER', 90)).toBe(false)
  })

  test('EMPLOYEE cannot access HR routes', () => {
    expect(canAccess('EMPLOYEE', 70)).toBe(false)
  })

  test('BDM can access DSE routes', () => {
    expect(canAccess('BDM', 40)).toBe(true)
  })
})

describe('isInternalRole', () => {
  test('employees are internal', () => {
    expect(isInternalRole('EMPLOYEE')).toBe(true)
    expect(isInternalRole('ADMIN')).toBe(true)
    expect(isInternalRole('HR')).toBe(true)
  })

  test('partners and vendors are external', () => {
    expect(isInternalRole('PARTNER')).toBe(false)
    expect(isInternalRole('VENDOR')).toBe(false)
    expect(isInternalRole('CUSTOMER')).toBe(false)
  })
})
