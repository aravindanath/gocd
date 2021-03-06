/*
 * Copyright 2018 ThoughtWorks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {MithrilViewComponent} from "jsx/mithril-component";
import * as _ from "lodash";
import * as m from "mithril";
import {Stream} from "mithril/stream";
import {ConfigRepo, humanizedMaterialAttributeName} from "models/config_repos/types";
import {PluginInfo} from "models/shared/plugin_infos_new/plugin_info";
import {CollapsiblePanel} from "views/components/collapsible_panel";
import {FlashMessage, MessageType} from "views/components/flash_message";
import {Delete, Refresh, Settings} from "views/components/icons";
import {KeyValuePair} from "views/components/key_value_pair";
import {Spinner} from "views/components/spinner";
import * as styles from "./index.scss";

export interface SaveOperation {
  onSuccessfulSave: (msg: m.Children) => any;
  onError: (msg: m.Children) => any;
}

interface Operations<T> {
  onEdit: (obj: T, e: MouseEvent) => void;
  onDelete: (obj: T, e: MouseEvent) => void;
  onRefresh: (obj: T, e: MouseEvent) => void;
}

export interface RequiresPluginInfos {
  pluginInfos: Stream<Array<PluginInfo<any>>>;
}

export interface Attrs<T> extends Operations<T>, RequiresPluginInfos {
  objects: Stream<T | null>;
}

export interface State extends Operations<ConfigRepo>, SaveOperation, RequiresPluginInfos {
  configRepos: Stream<ConfigRepo[] | null>;

  onAdd: (e: MouseEvent) => void;
  message: m.Children;
  messageType: MessageType;
  clearMessage: () => void;
}

interface ShowObjectAttrs<T> extends Operations<T>, RequiresPluginInfos {
  obj: T;
}

interface HeaderWidgetAttrs extends RequiresPluginInfos {
  repo: ConfigRepo;
}

function findPluginWithId(infos: Array<PluginInfo<any>>, pluginId: string) {
  return _.find(infos, {id: pluginId});
}

class HeaderWidget extends MithrilViewComponent<HeaderWidgetAttrs> {
  view(vnode: m.Vnode<HeaderWidgetAttrs>): m.Children | void | null {

    return [
      this.statusIcon(vnode),
      (
        <KeyValuePair inline={true} data={new Map([
                                                    ["Id", vnode.attrs.repo.id()],
                                                    ["Plugin ID", vnode.attrs.repo.pluginId()]
                                                  ])}/>
      )
    ];
  }

  private statusIcon(vnode: m.Vnode<HeaderWidgetAttrs>) {
    const pluginInfo = findPluginWithId(vnode.attrs.pluginInfos(), vnode.attrs.repo.pluginId());

    if (!pluginInfo) {
      return (
        <span className={styles.missingPluginIcon}
              title={`Plugin '${vnode.attrs.repo.pluginId()}' was not found`}/>
      );
    }

    if (_.isEmpty(vnode.attrs.repo.lastParse())) {
      return (
        <span className={styles.neverParsed}
              title={`This configuration repository was never parsed.`}/>
      );
    }

    if (vnode.attrs.repo.lastParse().success) {
      return (
        <span className={styles.goodLastParseIcon}
              title={`Last parsed with revision ${vnode.attrs.repo.lastParse().revision}`}/>
      );
    } else {
      return (
        <span className={styles.lastParseErrorIcon}
              title={`Last parsed with revision ${vnode.attrs.repo.lastParse().revision}. The error was ${vnode.attrs.repo.lastParse().error}`}/>
      );
    }
  }
}

class ConfigRepoWidget extends MithrilViewComponent<ShowObjectAttrs<ConfigRepo>> {
  view(vnode: m.Vnode<ShowObjectAttrs<ConfigRepo>>): m.Children | void | null {

    const filteredAttributes = _.reduce(vnode.attrs.obj.material().attributes(), (accumulator: Map<string, string>,
                                                                                  value: any,
                                                                                  key: string) => {
      let renderedValue = value;

      const renderedKey = humanizedMaterialAttributeName(key);

      // test for value being a stream
      if (_.isFunction(value)) {
        value = value();
      }

      // test for value being an EncryptedPassword
      if (value && value.valueForDisplay) {
        renderedValue = value.valueForDisplay();
      }
      accumulator.set(renderedKey, renderedValue);
      return accumulator;
    }, new Map<string, string>());

    const refreshButton = (
      <Refresh data-test-id="config-repo-refresh" onclick={vnode.attrs.onRefresh.bind(vnode.attrs)}/>
    );

    const settingsButton = (
      <Settings data-test-id="config-repo-edit" onclick={vnode.attrs.onEdit.bind(vnode.attrs)}/>
    );

    const deleteButton = (
      <Delete data-test-id="config-repo-delete" onclick={vnode.attrs.onDelete.bind(vnode.attrs)}/>
    );

    const actionButtons = [
      refreshButton, settingsButton, deleteButton
    ];

    let lastParseRevision: m.Children;

    if (vnode.attrs.obj.lastParse() && vnode.attrs.obj.lastParse().revision()) {
      lastParseRevision = <div>Last seen revision: <code>{vnode.attrs.obj.lastParse().revision()}</code></div>;
    }

    let maybeWarning: m.Children;

    if (_.isEmpty(vnode.attrs.obj.lastParse())) {
      maybeWarning = (
        <FlashMessage type={MessageType.warning}>This configuration repository was never parsed.</FlashMessage>
      );
    } else if (vnode.attrs.obj.lastParse() && vnode.attrs.obj.lastParse().error()) {
      maybeWarning = (
        <FlashMessage type={MessageType.warning}>
          There was an error parsing this configuration repository:
          <pre>{vnode.attrs.obj.lastParse().error}</pre>
        </FlashMessage>
      );
    }

    const pluginInfo = findPluginWithId(vnode.attrs.pluginInfos(), vnode.attrs.obj.pluginId());

    if (!pluginInfo) {
      maybeWarning = (
        <FlashMessage type={MessageType.alert}>This plugin is missing.</FlashMessage>
      );
    }

    return (
      <CollapsiblePanel header={<HeaderWidget repo={vnode.attrs.obj} pluginInfos={vnode.attrs.pluginInfos}/>}
                        actions={actionButtons}>
        {maybeWarning}
        {lastParseRevision}
        <div><strong>SCM configuration for {vnode.attrs.obj.material().type()} material</strong></div>
        <KeyValuePair data={filteredAttributes}/>
      </CollapsiblePanel>
    );
  }
}

export class ConfigReposWidget extends MithrilViewComponent<Attrs<ConfigRepo[]>> {
  view(vnode: m.Vnode<Attrs<ConfigRepo[]>>): m.Children | void | null {
    if (!vnode.attrs.objects()) {
      return <Spinner/>;
    }

    const configRepos = (vnode.attrs.objects() as ConfigRepo[]);
    if (configRepos.length === 0) {
      return (
        <FlashMessage type={MessageType.info}>
          There are no config repositories setup. Click the "Add" button to add one.
        </FlashMessage>);
    }

    return (
      <div>
        {configRepos.map((configRepo) => {
          return (
            <ConfigRepoWidget key={configRepo.id()}
                              obj={configRepo}
                              pluginInfos={vnode.attrs.pluginInfos}
                              onEdit={vnode.attrs.onEdit.bind(vnode.state, configRepo)}
                              onRefresh={vnode.attrs.onRefresh.bind(vnode.state, configRepo)}
                              onDelete={vnode.attrs.onDelete.bind(vnode.state, configRepo)}
            />
          );
        })}
      </div>
    );
  }
}
