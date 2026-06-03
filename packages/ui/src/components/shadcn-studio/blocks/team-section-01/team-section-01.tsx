import { Card, CardContent, CardTitle } from '@tourism/ui/components/legacy/card'
import { Separator } from '@tourism/ui/components/legacy/separator'

import FacebookIcon from '@tourism/ui/assets/svg/facebook-icon'
import GithubIcon from '@tourism/ui/assets/svg/github-icon'
import InstagramIcon from '@tourism/ui/assets/svg/instagram-icon'
import TwitterIcon from '@tourism/ui/assets/svg/twitter-icon'

type TeamMember = {
  image: string
  alt: string
  name: string
  role: string
  description: string
  socialLinks: {
    facebook: string
    twitter: string
    github: string
    instagram: string
  }
}[]

const Team = ({ teamMembers }: { teamMembers: TeamMember }) => {
  return (
    <section className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='mb-12 text-center sm:mb-16 lg:mb-24'>
          <h2 className='mb-4 text-2xl font-semibold md:text-3xl lg:text-4xl'>Get to Know Our Amazing Team</h2>
          <p className='text-muted-foreground text-xl'>
            Meet the Passionate Experts Behind Our Success and Learn More About Their Roles.
          </p>
        </div>

        {/* Team Members */}
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-y-10 xl:grid-cols-4'>
          {teamMembers.map((member, index) => (
            <Card
              key={index}
              className='hover:ring-primary overflow-hidden pt-0 shadow-none transition-shadow duration-300'
            >
              <div className='bg-muted pt-10'>
                <img src={member.image} alt={member.alt} className='mx-auto h-60 w-auto' />
              </div>
              <CardContent className='space-y-3 text-base'>
                <CardTitle className='text-lg font-semibold'>{member.name}</CardTitle>
                <Separator />
                <div className='text-muted-foreground'>
                  <p className='mb-1 font-medium'>{member.role}</p>
                  <p>{member.description}</p>
                </div>
                <div className='flex gap-3'>
                  <a href={member.socialLinks.facebook}>
                    <FacebookIcon className='size-5' />
                  </a>
                  <a href={member.socialLinks.twitter}>
                    <TwitterIcon className='size-5' />
                  </a>
                  <a href={member.socialLinks.github}>
                    <GithubIcon className='size-5' />
                  </a>
                  <a href={member.socialLinks.instagram}>
                    <InstagramIcon className='size-5' />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Team
