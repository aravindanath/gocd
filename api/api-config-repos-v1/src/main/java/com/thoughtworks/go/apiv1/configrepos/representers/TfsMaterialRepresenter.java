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

package com.thoughtworks.go.apiv1.configrepos.representers;

import com.thoughtworks.go.api.base.OutputWriter;
import com.thoughtworks.go.api.representers.JsonReader;
import com.thoughtworks.go.config.materials.PasswordDeserializer;
import com.thoughtworks.go.config.materials.tfs.TfsMaterialConfig;
import com.thoughtworks.go.domain.materials.MaterialConfig;

class TfsMaterialRepresenter {
    private static final PasswordDeserializer PASSWORD_DESERIALIZER = new PasswordDeserializer();

    static void toJSON(OutputWriter json, TfsMaterialConfig material) {
        json.add("name", material.getName());
        json.add("auto_update", material.getAutoUpdate());
        json.add("url", material.getUrl());
        json.add("project_path", material.getProjectPath());
        json.add("domain", material.getDomain());
        json.add("username", material.getUserName());
        json.addIfNotNull("encrypted_password", material.getEncryptedPassword());
    }

    public static MaterialConfig fromJSON(JsonReader json) {
        TfsMaterialConfig materialConfig = new TfsMaterialConfig();
        json.readStringIfPresent("name", materialConfig::setName);
        json.readBooleanIfPresent("auto_update", materialConfig::setAutoUpdate);
        json.readStringIfPresent("url", materialConfig::setUrl);
        json.readStringIfPresent("project_path", materialConfig::setProjectPath);
        json.readStringIfPresent("domain", materialConfig::setDomain);
        json.readStringIfPresent("username", materialConfig::setUserName);

        String password = json.getStringOrDefault("password", null);
        String encryptedPassword = json.getStringOrDefault("encrypted_password", null);
        PASSWORD_DESERIALIZER.deserialize(password, encryptedPassword, materialConfig);
        return materialConfig;
    }
}
