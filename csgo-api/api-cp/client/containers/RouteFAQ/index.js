
import React, { Component } from 'react'
import { Link } from 'react-router'
import { connect } from 'react-redux'
import numeral from 'numeral'
import _ from 'underscore'

import { TextField } from 'office-ui-fabric-react/lib/TextField'
import { DetailsList, CheckboxVisibility, SelectionMode, Selection } from 'office-ui-fabric-react/lib/DetailsList'
import { DefaultButton, IButtonProps } from 'office-ui-fabric-react/lib/Button'
import { Checkbox } from 'office-ui-fabric-react/lib/Checkbox'
import { Spinner, SpinnerSize } from 'office-ui-fabric-react/lib/Spinner'
import { CommandBar } from 'office-ui-fabric-react/lib/CommandBar'
import api from 'lib/api'
import App from 'containers/App'
import Stats, { Stat } from 'components/Stats'

import CreateQuestionModal from './createQuestionModal'
import style from './style.css'

class RouteFAQ extends Component {
  constructor(props) {
    super(props)

    this.state = {
      loading: true,
      busy: false,
      showCreate: false,
      viewQuestion: null,

      questions: []
    }
  }

  componentDidMount() {
    App.setTitle('F.A.Q')

    this._refresh()
  }

  render() {
    const { loading, questions, disabled, busy, viewQuestion } = this.state

    return (
      <div>

        <CommandBar
          isSearchBoxVisible={false}

          items={[, {
            key: 'section',
            name: 'F.A.Q',
            disabled: true,
            onClick: () => false,
            items: [{
              key: 'general',
              name: 'F.A.Q'
            }]
          }, {
            key: 'addQuestion',
            name: 'Add Question',
            disabled: busy,
            onClick: () => this.setState({ showCreate: true, viewQuestion: null })
          }]}

          farItems={[]} />

        <div className={style.container}>
          <table>
            <thead>
              <tr>
                <td>Question</td>
                <td>Answer</td>
              </tr>
            </thead>
            <tbody>
              {questions.map(q =>
                <tr key={q.id}>
                  <td><a href="#" onClick={e => this._viewQuestion(e, q)}>{q.question}</a></td>
                  <td>{q.answer}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <CreateQuestionModal visible={this.state.showCreate}
          question={viewQuestion}
          onDismiss={() => this.setState({ showCreate: false })}
          refresh={::this._refresh} />
      </div>
    )
  }

  _viewQuestion(e, question) {
    e.preventDefault()

    this.setState({
      showCreate: true,
      viewQuestion: question
    })
  }

_refresh() {
    this.setState({
      loading: true
    })

    api('faq').then(({ questions }) => {
      this.setState({
        questions,
        loading: false
      })
    })
  }
}

export default connect(
  ({ currentUser }) => ({ currentUser }),
)((RouteFAQ))
