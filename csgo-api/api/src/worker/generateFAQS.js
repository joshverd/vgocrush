import r from '../lib/database'

const FAQ = r.db("csgoapi").table("FAQ");

const faqs = [
    {
        question: 'How come it crashes at 1.00x sometimes?',
        answer: 'This rare "insta-crash" is put in place to make sure people don\'t cashout at 1.01x everytime.'
    },
    {
        question: 'How much is the minimum to deposit?',
        answer: 'Currently, minimum to deposit is 1.0 credits per item.'
    },
    {
        question: 'I withdrew, but I didn\'t want to.',
        answer: 'We cannot return withdrawals even if they were by accident.'
    },
    {
        question: 'How do I deposit VGO Skins?',
        answer: 'You can deposit VGO Skins through WAX ExpquestionsTrade'
    },
    {
        question: 'My trade keeps getting canceled (After Retrying)?',
        answer: 'Most likely means that your trade URL is invalid, or you\'re unable to trade. To test this, ask a friend to trade with you using the URL you provided us. If it turns out your trade URL is functioning, then shoot us a message and we\'ll help out.'
    },
    {
        question: 'Where can I track the status of my withdraw request?',
        answer: 'You can go to \'Account\' on the top nav, and hit \'withdrawals\'.'
    },
    {
        question: 'What type of skins do you accept?',
        answer: 'At the moment, we only accept VGO Skins'
    },
    {
        question: 'I exchanged but lost money?',
        answer: 'When you exchange, the balance left over does not get put into your account.'
    },
    {
        question: 'My withdrawal got canceled/declined?',
        answer: 'You can always retry the trade by going to your account > withdrawals and hitting retry.'
    },
    {
        question: 'Is this game provably fair?\n',
        answer: 'Yes, you can read more about our provably fair system by clicking "Provably Fair" up top.\n'
    }
]

function insertFaqs() {
    faqs.forEach(async faq => {
        const {answer, question} = faq

        await FAQ.insert({
            createdAt: r.now(),
            question,
            answer
        })
    })
}

insertFaqs()