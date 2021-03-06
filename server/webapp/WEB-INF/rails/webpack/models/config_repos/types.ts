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

import * as _ from "lodash";
import {Stream} from "mithril/stream";
import * as stream from "mithril/stream";
import {
  ConfigRepoJSON,
  ConfigReposJSON, GitMaterialAttributesJSON, HgMaterialAttributesJSON, LastParseJSON,
  MaterialAttributesJSON, MaterialJSON,
  P4MaterialAttributesJSON, SvnMaterialAttributesJSON, TfsMaterialAttributesJSON,
} from "models/config_repos/serialization";
import {EncryptedValue} from "views/components/forms/encrypted_value";

const s = require("helpers/string-plus");

export abstract class ConfigRepos {
  static fromJSON(json?: ConfigReposJSON): ConfigRepo[] {
    return _.map(json!._embedded.config_repos, (json: ConfigRepoJSON) => {
      return ConfigRepo.fromJSON(json);
    });
  }
}

export class ConfigRepo {
  id: Stream<string>;
  pluginId: Stream<string>;
  material: Stream<Material>;
  configuration: Stream<any[]>;
  lastParse: Stream<LastParse>;

  constructor(id?: string,
              pluginId?: string,
              material?: Material,
              configuration?: any[],
              lastParse?: LastParse) {
    this.id            = stream(id);
    this.pluginId      = stream(pluginId);
    this.material      = stream(material);
    this.configuration = stream(configuration);
    this.lastParse     = stream(lastParse);
  }

  static fromJSON(json: ConfigRepoJSON) {
    return new ConfigRepo(json.id,
                          json.plugin_id,
                          Materials.fromJSON(json.material),
                          json.configuration,
                          LastParse.fromJSON(json.last_parse));
  }
}

export class LastParse {
  revision: Stream<string>;
  success: Stream<boolean>;
  error: Stream<string>;

  constructor(revision?: string, success?: boolean, error?: string) {
    this.revision = stream(revision);
    this.success  = stream(success);
    this.error    = stream(error);
  }

  static fromJSON(json: LastParseJSON) {
    if (!_.isEmpty(json)) {
      return new LastParse(json.revision, json.success, json.error);
    }
  }
}

class Materials {
  static fromJSON(material: MaterialJSON): Material {
    return new Material(material.type, MaterialAttributes.deserialize(material));
  }

}

export class Material {
  type: Stream<string>;
  attributes: Stream<MaterialAttributes>;

  constructor(type?: string, attributes?: MaterialAttributes) {
    this.attributes = stream(attributes);
    this.type       = stream(type);
  }

  typeProxy(value?: any) {
    if (arguments.length > 0) {
      const newType = value;
      if (this.type() !== newType) {
        this.attributes(MaterialAttributes.deserialize({
                                                         type: newType,
                                                         attributes: ({} as MaterialAttributesJSON)
                                                       }));
      }
      return this.type(newType);
    } else {
      return this.type();
    }
  }
}

export abstract class MaterialAttributes {

  protected constructor(name?: string, autoUpdate?: boolean) {
    this.name       = stream(name);
    this.autoUpdate = stream(autoUpdate);
  }

  name: Stream<string>;
  autoUpdate: Stream<boolean>;

  static deserialize(material: MaterialJSON) {
    switch (material.type) {
      case "git":
        return GitMaterialAttributes.fromJSON(material.attributes as GitMaterialAttributesJSON);
      case "svn":
        return SvnMaterialAttributes.fromJSON(material.attributes as SvnMaterialAttributesJSON);
      case "hg":
        return HgMaterialAttributes.fromJSON(material.attributes as HgMaterialAttributesJSON);
      case "p4":
        return P4MaterialAttributes.fromJSON(material.attributes as P4MaterialAttributesJSON);
      case "tfs":
        return TfsMaterialAttributes.fromJSON(material.attributes as TfsMaterialAttributesJSON);
      default:
        throw new Error(`Unknown material type ${material.type}`);
    }
  }

  toJSON() {
    const serialized                       = _.assign({}, this);
    const password: Stream<EncryptedValue> = _.get(serialized, "password");

    // remove the password field and setup the password serialization
    if (password) {
      // @ts-ignore
      delete serialized.password;

      if (password().isPlain() || password().isDirty()) {
        return _.assign({}, serialized, {password: password().value()});
      } else {
        return _.assign({}, serialized, {encrypted_password: password().value()});
      }
    }

    return serialized;
  }
}

export class GitMaterialAttributes extends MaterialAttributes {
  url: Stream<string>;
  branch: Stream<string>;

  constructor(name?: string, autoUpdate?: boolean, url?: string, branch?: string) {
    super(name, autoUpdate);
    this.url    = stream(url);
    this.branch = stream(branch);
  }

  static fromJSON(json: GitMaterialAttributesJSON) {
    return new GitMaterialAttributes(json.name, json.auto_update, json.url, json.branch);
  }
}

interface PasswordLike {
  cipherText?: string;
  plainText?: string;
}

function plainOrCipherValue(passwordLike: PasswordLike) {
  if (passwordLike.cipherText) {
    return new EncryptedValue({cipherText: s.defaultToIfBlank(passwordLike.cipherText, "")});
  } else {
    return new EncryptedValue({clearText: s.defaultToIfBlank(passwordLike.plainText, "")});
  }
}

export class SvnMaterialAttributes extends MaterialAttributes {
  url: Stream<string>;
  checkExternals: Stream<boolean>;
  username: Stream<string>;
  password: Stream<EncryptedValue>;

  constructor(name?: string,
              autoUpdate?: boolean,
              url?: string,
              checkExternals?: boolean,
              username?: string,
              password?: string,
              encryptedPassword?: string) {
    super(name, autoUpdate);
    this.url            = stream(url);
    this.checkExternals = stream(checkExternals);
    this.username       = stream(username);
    this.password       = stream(plainOrCipherValue({plainText: password, cipherText: encryptedPassword}));
  }

  static fromJSON(json: SvnMaterialAttributesJSON) {
    return new SvnMaterialAttributes(json.name,
                                     json.auto_update,
                                     json.url,
                                     json.check_externals,
                                     json.username,
                                     json.password,
                                     json.encrypted_password);
  }
}

export class HgMaterialAttributes extends MaterialAttributes {
  url: Stream<string>;

  constructor(name?: string, autoUpdate?: boolean, url?: string) {
    super(name, autoUpdate);
    this.url = stream(url);
  }

  static fromJSON(json: HgMaterialAttributesJSON) {
    return new HgMaterialAttributes(json.name, json.auto_update, json.url);
  }
}

export class P4MaterialAttributes extends MaterialAttributes {
  port: Stream<string>;
  useTickets: Stream<boolean>;
  view: Stream<string>;
  username: Stream<string>;
  password: Stream<EncryptedValue>;

  constructor(name?: string,
              autoUpdate?: boolean,
              port?: string,
              useTickets?: boolean,
              view?: string,
              username?: string,
              password?: string,
              encryptedPassword?: string) {
    super(name, autoUpdate);
    this.port       = stream(port);
    this.useTickets = stream(useTickets);
    this.view       = stream(view);
    this.username   = stream(username);
    this.password   = stream(plainOrCipherValue({plainText: password, cipherText: encryptedPassword}));
  }

  static fromJSON(json: P4MaterialAttributesJSON) {
    return new P4MaterialAttributes(json.name,
                                    json.auto_update,
                                    json.port,
                                    json.use_tickets,
                                    json.view,
                                    json.username,
                                    json.password,
                                    json.encrypted_password);
  }
}

export class TfsMaterialAttributes extends MaterialAttributes {
  url: Stream<string>;
  domain: Stream<string>;
  projectPath: Stream<string>;
  username: Stream<string>;
  password: Stream<EncryptedValue>;

  constructor(name?: string,
              autoUpdate?: boolean,
              url?: string,
              domain?: string,
              projectPath?: string,
              username?: string,
              password?: string,
              encryptedPassword?: string) {
    super(name, autoUpdate);
    this.url         = stream(url);
    this.domain      = stream(domain);
    this.projectPath = stream(projectPath);
    this.username    = stream(username);
    this.password    = stream(plainOrCipherValue({plainText: password, cipherText: encryptedPassword}));
  }

  static fromJSON(json: TfsMaterialAttributesJSON) {
    return new TfsMaterialAttributes(json.name,
                                     json.auto_update,
                                     json.url,
                                     json.domain,
                                     json.project_path,
                                     json.username,
                                     json.password,
                                     json.encrypted_password);
  }
}

const HUMAN_NAMES_FOR_MATERIAL_ATTRIBUTES: { [index: string]: string } = {
  auto_update: "Auto update",
  branch: "Branch",
  check_externals: "Check Externals",
  domain: "Domain",
  encrypted_password: "Password",
  name: "Material Name",
  project_path: "Project Path",
  url: "URL",
  username: "Username",
  password: "Password",
  port: "Host and port",
  use_tickets: "Use tickets",
  view: "View"
};

const MATERIAL_TYPE_MAP: { [index: string]: string } = {
  git: "Git",
  hg: "Mercurial",
  tfs: "Team Foundation Server",
  svn: "Subversion",
  p4: "Perforce",
};

export function humanizedMaterialNameForMaterialType(materialType: string) {
  return MATERIAL_TYPE_MAP[materialType];
}

export function humanizedMaterialAttributeName(key: string) {
  return HUMAN_NAMES_FOR_MATERIAL_ATTRIBUTES[key] || key;
}
