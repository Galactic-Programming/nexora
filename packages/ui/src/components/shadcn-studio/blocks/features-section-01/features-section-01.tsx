import type { ReactElement } from 'react'
import { Avatar, AvatarFallback } from '@tourism/ui/components/legacy/avatar'
import { Button } from '@tourism/ui/components/legacy/button'
import { Card, CardContent } from '@tourism/ui/components/legacy/card'

import { cn } from '@tourism/ui/lib/utils'
import { ArrowRightIcon } from "lucide-react"

type Features = {
  icon: ReactElement
  title: string
  description: string
  cardBorderColor: string
  avatarTextColor: string
  avatarBgColor: string
}[]

const Features = ({ featuresList }: { featuresList: Features }) => {
  return (
    <section className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {/* Header */}
        <div className='mb-12 space-y-4 sm:mb-16 lg:mb-24'>
          <h2 className='text-2xl font-semibold md:text-3xl lg:text-4xl'>Discover the Exclusive Perks Today</h2>
          <p className='text-muted-foreground text-xl'>
            Explore key features designed to enhance your shopping experience with intuitive navigation, robust
            security, and seamless functionality.
          </p>
          <Button variant='outline' size='lg' render={<a href='#' />} nativeButton={false}>
            See all features
            <ArrowRightIcon
            />
          </Button>
        </div>

        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
          {featuresList.map((features, index) => (
            <Card
              key={index}
              className={cn('text-base shadow-none transition-colors duration-300', features.cardBorderColor)}
            >
              <CardContent>
                <Avatar size='lg' className='mb-6 rounded-md after:border-0'>
                  <AvatarFallback
                    className={cn('rounded-md [&>svg]:size-6', features.avatarBgColor, features.avatarTextColor)}
                  >
                    {features.icon}
                  </AvatarFallback>
                </Avatar>
                <h6 className='mb-2 text-lg font-semibold'>{features.title}</h6>
                <p className='text-muted-foreground'>{features.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
