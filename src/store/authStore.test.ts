import { beforeEach, expect, test, vi } from 'vitest';
const mocks=vi.hoisted(()=>({getProfile:vi.fn(),token:'maintenance-token'}));
vi.mock('@/lib/api',()=>({api:{getProfile:mocks.getProfile}}));
vi.mock('@/lib/apiClient',()=>({getAccessToken:()=>mocks.token,setTokens:(token:string)=>{mocks.token=token;},clearTokens:vi.fn()}));
import {useAuthStore} from './authStore';
import type {User} from '@/types';
const maintenance={id:'school',role:'school'} as User;
const admin={id:'admin',role:'admin'} as User;
beforeEach(()=>{vi.clearAllMocks();mocks.token='maintenance-token';useAuthStore.setState({user:maintenance,isAuthenticated:true,impersonating:true,impersonatedUser:maintenance,_adminToken:'admin-token'});});
test('exit waits for the administrator profile before clearing maintenance state',async()=>{
 let resolve!: (value:{data:User})=>void;
 mocks.getProfile.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const exit=useAuthStore.getState().exitImpersonation();
 expect(useAuthStore.getState().impersonating).toBe(true);
 resolve({data:admin});await exit;
 expect(useAuthStore.getState()).toMatchObject({user:admin,impersonating:false,_adminToken:null});
 expect(mocks.token).toBe('admin-token');
});
test('a temporary outage preserves the maintenance session and allows retry',async()=>{
 mocks.getProfile.mockRejectedValueOnce(new Error('503'));
 await expect(useAuthStore.getState().exitImpersonation()).rejects.toThrow('503');
 expect(useAuthStore.getState()).toMatchObject({user:maintenance,impersonating:true,_adminToken:'admin-token'});
 expect(mocks.token).toBe('maintenance-token');
 mocks.getProfile.mockResolvedValueOnce({data:admin});
 await useAuthStore.getState().exitImpersonation();
 expect(useAuthStore.getState().user).toEqual(admin);
});
