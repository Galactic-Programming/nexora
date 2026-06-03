import type { ReactNode } from 'react'

import { Card } from '@tourism/ui/components/legacy/card'

type ComparisonData = {
  features: {
    name: string
    column1: string | ReactNode
    column2: string | ReactNode
    column3: string | ReactNode
  }[]
  column1Header: {
    icon?: string | { light: string; dark: string }
    title: string
  }
  column2Header: {
    icon?: string | { light: string; dark: string }
    title: string
  }
  column3Header: string
}

const CompareUILib = ({ data }: { data: ComparisonData }) => {
  return (
    <div className='bg-muted px-4 py-8 sm:px-6 sm:py-16 lg:px-8 lg:py-24'>
      <div className='bg-background mx-auto max-w-7xl space-y-12 rounded-3xl px-8 py-16'>
        {/* Header */}
        <div className='mb-8 space-y-4 md:mb-12 lg:mb-24'>
          <h2 className='text-center text-xl font-semibold sm:text-2xl md:text-3xl lg:text-4xl'>
            Choose the Right AI Tool for Powerful, Faster Writing
          </h2>
          <p className='text-muted-foreground mx-auto max-w-4xl text-center text-base md:text-xl'>
            Find the perfect AI tool to help you write clearer, faster, and more impactful content.
          </p>
        </div>
        {/* Comparison Table */}
        <Card className='overflow-hidden overflow-x-auto py-0'>
          <table className='w-full'>
            <thead>
              <tr className='bg-primary/10 border-b'>
                <th className='h-25 w-68 p-4 text-left text-xl font-normal lg:text-2xl'>Features</th>
                <th className='h-25 w-68 p-4 text-left text-xl font-normal lg:text-2xl'>
                  <div className='flex min-w-35 items-center gap-3.5'>
                    {data.column1Header.icon &&
                      (typeof data.column1Header.icon === 'string' ? (
                        <img
                          src={data.column1Header.icon}
                          alt={data.column1Header.title}
                          className='size-6 md:size-7.5'
                        />
                      ) : (
                        <>
                          <img
                            src={data.column1Header.icon.light}
                            alt={data.column1Header.title}
                            className='size-6 md:size-7.5 dark:hidden'
                          />
                          <img
                            src={data.column1Header.icon.dark}
                            alt={data.column1Header.title}
                            className='hidden size-6 md:size-7.5 dark:block'
                          />
                        </>
                      ))}
                    <span>{data.column1Header.title}</span>
                  </div>
                </th>
                <th className='h-25 w-68 p-4 text-left text-xl font-normal lg:text-2xl'>
                  <div className='flex items-center gap-3.5'>
                    {data.column2Header.icon &&
                      (typeof data.column2Header.icon === 'string' ? (
                        <img src={data.column2Header.icon} alt={data.column2Header.title} className='size-7.5' />
                      ) : (
                        <>
                          <img
                            src={data.column2Header.icon.light}
                            alt={data.column2Header.title}
                            className='size-7.5 dark:hidden'
                          />
                          <img
                            src={data.column2Header.icon.dark}
                            alt={data.column2Header.title}
                            className='hidden size-7.5 dark:block'
                          />
                        </>
                      ))}
                    <span>{data.column2Header.title}</span>
                  </div>
                </th>
                <th className='h-25 p-4 text-left text-xl font-normal lg:text-2xl'>{data.column3Header}</th>
              </tr>
            </thead>
            <tbody>
              {data.features.map((feature, index) => (
                <tr key={index} className='h-25 not-last:border-b'>
                  <td className='p-4'>
                    <div className='text-lg font-medium'>
                      {index + 1}. {feature.name}
                    </div>
                  </td>
                  <td className='p-4'>
                    <div className='text-muted-foreground text-base font-normal'>{feature.column1}</div>
                  </td>
                  <td className='p-4'>
                    <div className='text-muted-foreground text-base font-normal'>{feature.column2}</div>
                  </td>
                  <td className='p-4'>
                    <div className='text-muted-foreground text-base font-normal'>{feature.column3}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  )
}

export default CompareUILib
