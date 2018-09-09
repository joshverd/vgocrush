
import React from 'react'

import { Modal } from 'office-ui-fabric-react/lib/Modal'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import { TextField } from 'office-ui-fabric-react/lib/TextField'

import api from 'lib/api'
import style from './style.css'

export default class CreateQuestionModal extends React.Component {

  constructor(props) {
    super(props)

    this.state = this._getInitialState()
  }

  _getInitialState() {
    let question = this.props.question || {}

    return {
      busy: false,
      faq: {
        group: question.group || '',
        question: question.question || '',
        answer: question.answer || ''
      }
    }
  }

  componentDidUpdate(prevProps) {
    if(this.props.visible !== prevProps.visible && this.props.visible) {
      this.setState(this._getInitialState())
    }
  }

  render() {
    const { busy, faq } = this.state
    const { group, question, answer } = faq

    return (
      <Modal isOpen={this.props.visible}
        onDismiss={::this._onDismiss}
        isBlocking={busy}
        containerClassName={style.createModalContainer}>

        <CommandBar
          isSearchBoxVisible={false}

          items={[, {
            key: 'section',
            name: 'Add Question',
            disabled: busy,
            onClick: () => false
          }]}

          farItems={[{
            key: 'save',
            name: !busy ? 'Save' : 'Saving...',
            disabled: busy || !answer.length || !question.length,
            onClick: ::this._onSave
          }]} />

        <div className={style.modalBody}>
          <TextField disabled={busy} label='Question' value={question} onChanged={v => this._updateFAQ({ question: v })} />
          <TextField disabled={busy} label='Answer' multiline rows={5} value={answer} onChanged={v => this._updateFAQ({ answer: v })} />
        </div>
      </Modal>
    )
  }

  _updateFAQ(update) {
    this.setState({
      faq: {
        ...this.state.faq,
        ...update
      }
    })
  }

  _onDismiss() {
    this.setState(this._getInitialState())
    this.props.onDismiss()
  }

  _onSave() {
    this.setState({
      busy: true
    })

    const { id, group, question, answer } = this.state.faq

    api('faq/save', {
      body: {
        question,
        answer,

        id: !!this.props.question ? this.props.question.id : null
      }
    })

    .then(() => {
      this.props.refresh()
      this.props.onDismiss()

      this.setState(this._getInitialState())
    }, () =>
      this.setState({
        busy: false
      })
    )
  }
}
