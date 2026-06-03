import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/legacy/card'
import { Button } from '@tourism/ui/components/legacy/button'

import Logo from '@tourism/ui/components/shadcn-studio/logo'
import AuthBackgroundShape from '@tourism/ui/assets/svg/auth-background-shape'
import ResetPasswordForm from '@tourism/ui/components/shadcn-studio/blocks/reset-password-01/reset-password-form'
import { ChevronLeftIcon } from "lucide-react"

const ResetPassword = () => {
  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8'>
      <div className='absolute'>
        <AuthBackgroundShape />
      </div>

      <Card className='z-1 w-full gap-6 py-6 sm:max-w-md'>
        <CardHeader className='gap-6 px-6'>
          <Logo className='gap-3' />

          <div>
            <CardTitle className='mb-2 text-2xl font-semibold'>Reset Password</CardTitle>
            <CardDescription className='text-base'>
              Please enter your current password and choose a new password to update your account security.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='space-y-4 px-6'>
          {/* ResetPassword Form */}
          <ResetPasswordForm />

          <Button variant='ghost' className='group w-full' render={<a href='#' />} nativeButton={false}>
            <ChevronLeftIcon className='size-5 transition-transform duration-200 group-hover:-translate-x-0.5' />
            Back to login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default ResetPassword
