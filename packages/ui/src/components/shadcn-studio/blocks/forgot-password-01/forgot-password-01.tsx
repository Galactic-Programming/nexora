import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tourism/ui/components/legacy/card'
import { Button } from '@tourism/ui/components/legacy/button'

import ForgotPasswordForm from '@tourism/ui/components/shadcn-studio/blocks/forgot-password-01/forgot-password-form'
import AuthBackgroundShape from '@tourism/ui/assets/svg/auth-background-shape'
import Logo from '@tourism/ui/components/shadcn-studio/logo'
import { ChevronLeftIcon } from "lucide-react"

const ForgotPassword = () => {
  return (
    <div className='relative flex h-auto min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:px-6 lg:px-8'>
      <div className='absolute'>
        <AuthBackgroundShape />
      </div>

      <Card className='z-1 w-full gap-6 py-6 sm:max-w-md'>
        <CardHeader className='gap-6 px-6'>
          <Logo className='gap-3' />

          <div>
            <CardTitle className='mb-1.5 text-2xl font-semibold'>Forgot Password?</CardTitle>
            <CardDescription className='text-base'>
              Enter your email and we&apos;ll send you instructions to reset your password
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className='space-y-4 px-6'>
          {/* ForgotPassword Form */}
          <ForgotPasswordForm />

          <Button variant='ghost' className='group w-full' render={<a href='#' />} nativeButton={false}>
            <ChevronLeftIcon className='size-5 transition-transform duration-200 group-hover:-translate-x-0.5' />
            Back to login
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default ForgotPassword
