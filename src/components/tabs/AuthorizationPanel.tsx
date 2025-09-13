import React from 'react';
import { AuthDetails, AuthType, GrantType } from '../../types';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Button } from '../ui/Button';

interface AuthorizationPanelProps {
  auth: AuthDetails;
  onAuthChange: (auth: AuthDetails) => void;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'apiKey', label: 'API Key' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'jwt', label: 'JWT Bearer' },
  { value: 'oauth2', label: 'OAuth 2.0' },
];

const GRANT_TYPES: { value: GrantType, label: string }[] = [
    { value: 'authorization_code', label: 'Authorization Code' },
    { value: 'implicit', label: 'Implicit' },
    { value: 'password_credentials', label: 'Password Credentials' },
    { value: 'client_credentials', label: 'Client Credentials' },
]

export const AuthorizationPanel: React.FC<AuthorizationPanelProps> = ({ auth, onAuthChange }) => {
  const handleTypeChange = (value: string) => {
    onAuthChange({ type: value as AuthType });
  };
  
  const handleOauth2Change = (field: string, value: string) => {
      onAuthChange({ ...auth, oauth2: { ...auth.oauth2!, [field]: value } as any })
  }
  
  const renderAuthDetails = () => {
    switch(auth.type) {
      case 'bearer':
      case 'jwt':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
            <label className="text-sm font-medium text-muted-foreground">Token</label>
            <Input 
              type="text" 
              placeholder="Your API token"
              value={auth.token || ''}
              onChange={(e) => onAuthChange({ ...auth, token: e.target.value })}
              className="md:col-span-3"
            />
          </div>
        );
      case 'basic':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <Input
                type="text"
                value={auth.basicUser || ''}
                onChange={(e) => onAuthChange({ ...auth, basicUser: e.target.value })}
                className="md:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <Input
                type="password"
                value={auth.basicPass || ''}
                onChange={(e) => onAuthChange({ ...auth, basicPass: e.target.value })}
                className="md:col-span-3"
              />
            </div>
          </div>
        );
      case 'apiKey':
        return (
           <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
              <label className="text-sm font-medium text-muted-foreground">Key</label>
              <Input
                type="text"
                placeholder="api_key"
                value={auth.apiKeyKey || ''}
                onChange={(e) => onAuthChange({ ...auth, apiKeyKey: e.target.value })}
                className="md:col-span-3"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
              <label className="text-sm font-medium text-muted-foreground">Value</label>
              <Input
                type="text"
                placeholder="Your API key value"
                value={auth.apiKeyValue || ''}
                onChange={(e) => onAuthChange({ ...auth, apiKeyValue: e.target.value })}
                className="md:col-span-3"
              />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-1 md:items-center">
              <label className="text-sm font-medium text-muted-foreground">Add to</label>
              <Select
                value={auth.apiKeyAddTo || 'header'}
                onValueChange={(value) => onAuthChange({ ...auth, apiKeyAddTo: value as 'header' | 'query' })}
              >
                <SelectTrigger className="md:col-span-3">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="query">Query Params</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
       case 'oauth2':
        return (
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Grant Type</label>
                    <Select value={auth.oauth2?.grantType} onValueChange={value => handleOauth2Change('grantType', value)} >
                       <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                       <SelectContent>
                         {GRANT_TYPES.map(gt => <SelectItem key={gt.value} value={gt.value}>{gt.label}</SelectItem>)}
                       </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Callback URL</label>
                    <Input value={auth.oauth2?.callbackUrl} onChange={e => handleOauth2Change('callbackUrl', e.target.value)} className="md:col-span-2" />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Auth URL</label>
                    <Input value={auth.oauth2?.authUrl} onChange={e => handleOauth2Change('authUrl', e.target.value)} className="md:col-span-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Access Token URL</label>
                    <Input value={auth.oauth2?.accessTokenUrl} onChange={e => handleOauth2Change('accessTokenUrl', e.target.value)} className="md:col-span-2" />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Client ID</label>
                    <Input value={auth.oauth2?.clientId} onChange={e => handleOauth2Change('clientId', e.target.value)} className="md:col-span-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Client Secret</label>
                    <Input value={auth.oauth2?.clientSecret} onChange={e => handleOauth2Change('clientSecret', e.target.value)} className="md:col-span-2" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="font-medium text-muted-foreground">Scope</label>
                    <Input value={auth.oauth2?.scope} onChange={e => handleOauth2Change('scope', e.target.value)} className="md:col-span-2" />
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="secondary" disabled>Get New Access Token</Button>
                </div>
            </div>
        )
      default:
        return (
          <p className="text-sm text-muted-foreground">
            This request does not use any authorization.
          </p>
        );
    }
  }

  return (
    <div className="p-4 flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-1/3">
        <label className="block text-sm font-medium text-foreground mb-2">Auth Type</label>
        <Select value={auth.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="w-full lg:w-2/3 pt-2">
        {renderAuthDetails()}
      </div>
    </div>
  );
};