import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/legacy/card'

import Logo from '@tourism/ui/components/shadcn-studio/logo'
import AuthBackgroundShape from '@tourism/ui/assets/svg/auth-background-shape'
import TwoFactorAuthenticationForm from '@tourism/ui/components/shadcn-studio/blocks/two-factor-authentication-01/two-factor-authentication-form'

const TwoFactorAuthentication = () => {
  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8'>
      <div className='absolute'>
        <AuthBackgroundShape />
      </div>

      <Card className='z-1 w-full gap-6 overflow-clip py-6 sm:max-w-md'>
        <CardHeader className='px-6'>
          <Logo className='gap-3' />
        </CardHeader>

        <CardContent className='space-y-6 px-6'>
          <div>
            <CardTitle className='mb-2 text-2xl font-semibold'>Two Factor Authentication</CardTitle>
            <CardDescription className='text-base'>
              Please confirm access to your account by entering the code provided by your authenticator application
            </CardDescription>
          </div>

          {/* TwoFactorAuthentication Form */}
          <TwoFactorAuthenticationForm />
        </CardContent>
      </Card>
    </div>
  )
}

export default TwoFactorAuthentication
