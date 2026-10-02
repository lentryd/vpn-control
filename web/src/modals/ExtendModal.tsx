import { Alert } from '@mantine/core'
import { PiCalendarPlus, PiCalendarPlusDuotone } from 'react-icons/pi'
import { useDebouncedValue } from '@mantine/hooks'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { api } from '@/api/client'
import { useApiMutation } from '@/api/hooks'
import type { ExtensionResult, Period } from '@/api/types'
import { fmtDate } from '@/components/format'
import { notifyError, notifyOk } from '@/components/notify'
import { PaymentSection, tariffPresets, type Term, TermSection } from '@/components/term'
import { FormColumns, FormFooter } from '@shared/ui/forms/form-section'

import { openModal } from './open'
import i18n from '@/app/i18n/i18n'
import { useTranslation } from 'react-i18next'

type Kind = 'subscription' | 'addon'

interface ExtendQuote {
    amount: number
    from: string
    to: string
    monthly: number
    periods: Period[]
    balance: number
}

export function openExtendModal(p: { kind: Kind; id: number; title: string }) {
    openModal({ icon: PiCalendarPlusDuotone, color: 'teal', title: i18n.t('sub.renewal'), subtitle: p.title }, (close) => <ExtendForm {...p} onDone={close} />, '1000px')
}

function ExtendForm({ kind, id, onDone }: { kind: Kind; id: number; onDone: () => void }) {
    const { t } = useTranslation()
    const [term, setTerm] = useState<Term>({ months: 1, days: 0, until: null })
    const [amount, setAmount] = useState<number | null>(null)
    const [touched, setTouched] = useState(false)
    const [allowDebt, setAllowDebt] = useState(false)
    const [debounced] = useDebouncedValue(term, 250)

    const quote = useQuery({
        queryKey: ['quote', kind, id, debounced.months, debounced.days],
        queryFn: () => api.get<ExtendQuote>(`items/${kind}/${id}/quote?months=${debounced.months}&days=${debounced.days}`),
        placeholderData: keepPreviousData
    })
    useEffect(() => {
        if (!touched && quote.data) setAmount(quote.data.amount)
    }, [quote.data, touched])

    const m = useApiMutation(() =>
        api.post<ExtensionResult>(`items/${kind}/${id}/extend`, { months: term.months, days: term.days, amount: amount ?? 0, allow_debt: allowDebt })
    )
    const submit = () =>
        m.mutate(undefined, {
            onSuccess: (r) => {
                notifyOk(t('extend.done', { date: fmtDate(r.to) }))
                onDone()
            },
            onError: (e) => notifyError(e)
        })

    return (
        <>
            <FormColumns
                left={
                    <TermSection
                        from={quote.data?.from}
                        onChange={(t) => {
                            setTerm(t)
                            setTouched(false)
                        }}
                        presets={tariffPresets(quote.data?.monthly, quote.data?.periods)}
                        value={term}
                    >
                        {quote.error && (
                            <Alert color="red" variant="soft">
                                {quote.error.message}
                            </Alert>
                        )}
                    </TermSection>
                }
                right={
                    <PaymentSection
                        allowDebt={allowDebt}
                        amount={amount}
                        balance={quote.data?.balance}
                        monthly={quote.data?.monthly}
                        onAllowDebt={setAllowDebt}
                        onAmount={(v) => {
                            setTouched(true)
                            setAmount(v)
                        }}
                    />
                }
            />
            <FormFooter
                disabled={term.months + term.days <= 0}
                loading={m.isPending}
                onCancel={onDone}
                onSubmit={submit}
                submitIcon={<PiCalendarPlus size={16} />}
                submitLabel={t('extend.submit')}
            />
        </>
    )
}
